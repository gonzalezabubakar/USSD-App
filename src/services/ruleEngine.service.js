// src/services/ruleEngine.service.js
const prisma = require('../config/prisma');
const fuzzyService = require('./fuzzy.service');
const geminiService = require('./gemini.service');
const smsService = require('./sms.service');
const { runWithTimeout } = require('../utils/timeout.util'); // Tumeivuta wrapper hapa

class RuleEngineService {
    constructor() {
        this.AI_TIMEOUT_MS = 3500; // Rahisi kubadilisha hapa baadae
    }

    async diagnoseAndLog(farmId, symptom) {
        console.log(`[RuleEngine]: Inachakata Shamba ID: ${farmId}`);
        const parsedFarmId = parseInt(farmId);
        
        try {
            const farm = await prisma.farm.findUnique({
                where: { farm_id: parsedFarmId },
                include: { farmer: true, crop: true }
            });

            if (!farm) throw new Error("Shamba halikupatikana kwenye mfumo.");
            const currentCropName = (farm.crop ? farm.crop.crop_name : (farm.crop_name || "")).toLowerCase().trim();
            const farmerPhoneNumber = farm.farmer ? farm.farmer.phone_number : null;

            // 1. ANZA NA EXPERT RULES (LOCAL DATABASE / EXCEL DATA)
            const dbRules = await prisma.expertRule.findMany({ where: { crop_name: currentCropName } });
            let matchedRule = null;
            let highestScore = 0;

            for (const rule of dbRules) {
                const score = fuzzyService.calculateMatchScore(symptom, rule.symptom_keyword);
                if (score > highestScore && score > 0) {
                    highestScore = score;
                    matchedRule = rule;
                }
            }

            if (highestScore > 0 && matchedRule) {
                return await this.handleExpertRuleMatch(parsedFarmId, matchedRule, farmerPhoneNumber);
            } 
            
            // 2. KAMA LOCAL RULES ZINEGOMA -> PELEKA KWA GEMINI AI 
            return await this.handleAiFallbackWithTimeout(parsedFarmId, farm.crop.crop_name, symptom, farmerPhoneNumber);

        } catch (error) {
            console.error("[RuleEngine Critical Error]:", error.message);
            return { success: false, diagnosis: "Hitilafu ya Mfumo", recommendation: "Jaribu tena baadae kidogo." };
        }
    }

    /**
     * Inashughulikia majibu yaliyopatikana kwenye Local Database (Expert Rules)
     */
    async handleExpertRuleMatch(farmId, rule, phoneNumber) {
        const savedLog = await prisma.advisoryLog.create({
            data: {
                farm_id: farmId,
                reported_symptom: rule.symptom_keyword,
                diagnosis: rule.diagnosis,
                recommendation: rule.recommendation,
                source: "USSD_EXPERT_RULE"
            }
        });

        if (phoneNumber) {
            smsService.sendAdvisorySms(phoneNumber, {
                diagnosis: rule.diagnosis,
                recommendation: rule.recommendation
            }).catch(err => console.error("SMS Error (Expert Rule):", err.message));
        }

        return {
            success: true,
            show_on_menu: true,
            diagnosis: rule.diagnosis,
            recommendation: rule.recommendation,
            log_id: savedLog.log_id
        };
    }

    /**
     * Inashughulikia upigaji wa Gemini AI kwa uangalizi wa Wrapper ya Timeout
     */
    async handleAiFallbackWithTimeout(farmId, cropName, symptom, phoneNumber) {
        console.log(`[RuleEngine]: Maneno hayapo kwenye sheria za ndani. Inaita Gemini AI...`);

        try {
            // Hapa tunatumia ile Utility yetu tuliyoandika pembeni! clean kabisa!
            const aiResult = await runWithTimeout(
                geminiService.askFallback(cropName, symptom), 
                this.AI_TIMEOUT_MS
            );
            
            if (aiResult) {
                const savedLog = await prisma.advisoryLog.create({
                    data: {
                        farm_id: farmId,
                        reported_symptom: symptom,
                        diagnosis: aiResult.diagnosis,
                        recommendation: aiResult.recommendation,
                        source: "USSD_GEMINI_FALLBACK"
                    }
                });

                if (phoneNumber) {
                    smsService.sendAdvisorySms(phoneNumber, aiResult).catch(err => console.error("❌ SMS Error (Fast AI):", err.message));
                }

                return {
                    success: true,
                    show_on_menu: true,
                    diagnosis: aiResult.diagnosis,
                    recommendation: aiResult.recommendation,
                    log_id: savedLog.log_id
                };
            }
        } catch (error) {
            // Kama hitilafu ni kwa sababu ya muda kuisha (Timeout) au error nyingine kutoka Gemini
            console.warn("[RuleEngine]: AI imezidi muda au imefeli. Inahamishiwa background processing...");
            
            // Inatupa kazi kwenda background na inamwachia mtumiaji USSD yake ikiwa salama
            this.executeLongRunningAiProcess(farmId, cropName, symptom, phoneNumber).catch(err => {
                console.error("[Background AI Async Error]:", err.message);
            });

            return {
                success: true,
                show_on_menu: false,
                diagnosis: "Uchambuzi wa AI",
                recommendation: "Mifumo yetu inachakata changamoto hii kupitia AI. Utatumiwa ujumbe mfupi (SMS) wa dozi na dawa kwenye simu yako sasa hivi."
            };
        }
    }

    /**
     * Gemini AI kwa chini chini (Asynchronously)
     */
    async executeLongRunningAiProcess(farmId, cropName, symptom, phoneNumber) {
        const aiResult = await geminiService.askFallback(cropName, symptom);
        
        const finalDiagnosis = aiResult ? aiResult.diagnosis : "Changamoto ya AI (Muda Mrefu)";
        const finalRecommendation = aiResult ? aiResult.recommendation : "Tafadhali kagua zao lako au wasiliana na afisa ugani.";

        await prisma.advisoryLog.create({
            data: {
                farm_id: farmId,
                reported_symptom: symptom,
                diagnosis: finalDiagnosis,
                recommendation: finalRecommendation,
                source: "USSD_GEMINI_FALLBACK"
            }
        });

        if (phoneNumber) {
            await smsService.sendAdvisorySms(phoneNumber, {
                diagnosis: finalDiagnosis,
                recommendation: finalRecommendation
            });
        }
    }
}

module.exports = new RuleEngineService();