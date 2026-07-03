// src/services/ruleEngine.service.js
const prisma = require('../config/prisma');
const fuzzyService = require('./fuzzy.service');
const geminiService = require('./gemini.service');
const smsService = require('./sms.service');
const { runWithTimeout } = require('../utils/timeout.util'); 

class RuleEngineService {
    constructor() {
        this.AI_TIMEOUT_MS = 3500; 
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

            // Kama tumepata sheria ya ndani, tunahifadhi na kurudisha majibu hapo hapo
            if (highestScore > 0 && matchedRule) {
                return await this.handleExpertRuleMatch(parsedFarmId, matchedRule, farmerPhoneNumber, symptom);
            } 
            
            // 2. KAMA LOCAL RULES ZIMEGOMA -> PELEKA KWA GEMINI AI 
            return await this.handleAiFallbackWithTimeout(parsedFarmId, farm.crop.crop_name, symptom, farmerPhoneNumber);

        } catch (error) {
            console.error("[RuleEngine Critical Error]:", error.message);
            return { success: false, diagnosis: "Hitilafu ya Mfumo", recommendation: "Jaribu tena baadae kidogo." };
        }
    }

    /**
     * Inashughulikia majibu yaliyopatikana kwenye Local Database (Expert Rules)
     */
    async handleExpertRuleMatch(farmId, rule, phoneNumber, rawQuery) {
        const savedLog = await prisma.advisoryLog.create({
            data: {
                farm_id: farmId,
                reported_symptom: rule.symptom_keyword, 
                rawSymptomQuery: rawQuery,             
                diagnosis: rule.diagnosis,
                recommendation: rule.recommendation,
                source: "USSD_EXPERT_RULE"
            }
        });

        // if (phoneNumber) {
        //     smsService.sendAdvisorySms(phoneNumber, {
        //         diagnosis: rule.diagnosis,
        //         recommendation: rule.recommendation
        //     }).catch(err => console.error("SMS Error (Expert Rule):", err.message));
        // }

        return {
            success: true,
            show_on_menu: true,
            diagnosis: rule.diagnosis,
            recommendation: rule.recommendation,
            log_id: savedLog.log_id || savedLog.id
        };
    }

    /**
     * Inashughulikia upigaji wa Gemini AI kwa uangalizi wa Wrapper ya Timeout
     */
    async handleAiFallbackWithTimeout(farmId, cropName, symptom, phoneNumber) {
        console.log(`[RuleEngine]: Maneno hayapo kwenye sheria za ndani. Inaita Gemini AI...`);

        try {
            // Jaribu kupiga AI na uisubiri kwa sekunde 3.5
            const aiResult = await runWithTimeout(
                geminiService.askUssdFallback(cropName, symptom), 
                this.AI_TIMEOUT_MS
            );
            
            // JIBU LA KWANZA: Kama AI imejibu haraka chini ya sekunde 3.5
            if (aiResult) {
                const savedLog = await prisma.advisoryLog.create({
                    data: {
                        farm_id: farmId,
                        reported_symptom: symptom,  
                        rawSymptomQuery: symptom,   
                        diagnosis: aiResult.diagnosis,
                        recommendation: aiResult.recommendation,
                        source: "USSD_GEMINI_FAST" // Hii imejibu fasta kwenye screen ya USSD
                    }
                });

                if (phoneNumber) {
                    smsService.sendAdvisorySms(phoneNumber, aiResult).catch(err => console.error("❌ SMS Error (Fast AI):", err.message));
                }

                return {
                    success: true,
                    show_on_menu: false, // Itaonekana kwenye screen ya USSD
                    diagnosis: aiResult.diagnosis,
                    recommendation: aiResult.recommendation,
                    log_id: savedLog.log_id || savedLog.id
                };
            }
        } catch (error) {
            // JIBU LA PILI: AI IMECHELEWA (TIMEOUT/CATCH)
            // Hapa hatuandiki kabisa ujumbe wa tahadhari kwenye Database!
            console.warn("[RuleEngine]: AI imezidi muda. Inahamishiwa background processing...");
            
            // Washa mchakato wa chini chini wa Gemini na SMS halisi
            this.executeLongRunningAiProcess(farmId, cropName, symptom, phoneNumber).catch(err => {
                console.error("[Background AI Async Error]:", err.message);
            });

            // Tunamrudishia tu mtumiaji ujumbe wa kistaarabu bila kuharibu DB wala kukata text
            return {
                success: true,
                show_on_menu: false, // Inaiambia controller isionyeshe jibu la ugonjwa lililokatwa
                diagnosis: "Uchambuzi wa AI Unaendelea",
                recommendation: "Mifumo yetu inachakata changamoto hii kupitia AI kwa sasa. Utatumiwa ujumbe mfupi (SMS) wenye majibu sahihi ya ugonjwa, dozi na dawa kwenye simu yako ndani ya muda mfupi. Ahsante!"
            };
        }
    }

    /**
     * Mchakato wa Gemini AI wa chini chini (Asynchronously) na utumaji wa SMS halisi
     */
    async executeLongRunningAiProcess(farmId, cropName, symptom, phoneNumber) {
        try {
            // Hapa background inaendelea kusubiri jibu halisi la Gemini hata likichukua sekunde 6 au 8
            const aiResult = await geminiService.askUssdFallback(cropName, symptom);
            
            if (!aiResult) throw new Error("Gemini hakurudisha jibu lolote la maana mazingira ya nyuma.");

            // HAPA NDIPO TUNAPOHIFADHI DATA SAHIHI! Mzizi wa jibu haupotei
            await prisma.advisoryLog.create({
                data: {
                    farm_id: farmId,
                    reported_symptom: symptom,  
                    rawSymptomQuery: symptom,   
                    diagnosis: aiResult.diagnosis,
                    recommendation: aiResult.recommendation,
                    source: "USSD_GEMINI_BACKGROUND"
                }
            });

            // Tuma SMS ya jibu halisi lililotoka kwa Gemini na sio ujumbe wa tahadhari!
            if (phoneNumber) {
                await smsService.sendAdvisorySms(phoneNumber, {
                    diagnosis: aiResult.diagnosis,
                    recommendation: aiResult.recommendation
                });
                console.log(`[Background AI]: SMS ya majibu halisi imetumwa kwa ${phoneNumber}`);
            }

        } catch (err) {
            console.error("[Background AI Critical Failure]:", err.message);
            // Ikishindikana kabisa hata huku nyuma, ndio unaweka fallback ya mfumo mzima
            if (phoneNumber) {
                await smsService.sendAdvisorySms(phoneNumber, {
                    diagnosis: "Uchunguzi Haukukamilika",
                    recommendation: "Tafadhali andika dalili za zao lako kwa kutumia maneno mepesi au wasiliana na afisa ugani wa karibu."
                }).catch(e => console.error(e.message));
            }
        }
    }
}

module.exports = new RuleEngineService();