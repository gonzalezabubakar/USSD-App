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

    // NJIA YA 3: Intent Classification (Kutambua mkulima anataka nini kabla ya AI)
    classifyIntent(symptomText) {
        const text = symptomText.toLowerCase().trim();
        if (text.match(/\b(habari|shikamoo|mambo|vip|hello|hi|asante|shukrani)\b/)) {
            return "SALAMU";
        }
        if (text.match(/\b(mbolea|dap|urea|minjingu|kupanda|nafasi|shamba|tengeneza)\b/)) {
            return "KILIMO_BORA";
        }
        return "UTAMBUZI_UGONJWA";
    }

    // NJIA YA 1: Local RAG/Database Context Lookup
    async findLocalContext(symptomText) {
        try {
            const words = symptomText.toLowerCase().trim().split(/\s+/);
            
            // Tunatafuta kwenye ExpertRule kama kuna maneno yoyote ya mkulima yanayoshabihiana
            const matchedRule = await prisma.expertRule.findFirst({
                where: {
                    OR: words.map(word => ({
                        symptom_keyword: { contains: word }
                    }))
                }
            });
            return matchedRule; 
        } catch (error) {
            console.error("[RAG Lookup Error]:", error.message);
            return null;
        }
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

            // Chakata Intent ya maneno ya mkulima
            const intent = this.classifyIntent(symptom);
            if (intent === "SALAMU") {
                return {
                    success: true,
                    show_on_menu: false,
                    diagnosis: "Karibu MSWAHILI AI",
                    recommendation: "Habari msimamizi! Andika dalili za zao lako (mfano: mahindi yana viwavi) ili kupata ushauri wa haraka."
                };
            }

            // 1. ANZA NA EXPERT RULES (FUZZY MATCHING YA SASA)
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
                return await this.handleExpertRuleMatch(parsedFarmId, matchedRule, farmerPhoneNumber, symptom);
            } 
            
            // 2. KAMA ZIMETIME-OUT / ZIMEGOMA -> Washa RAG + AI Fallback
            return await this.handleAiFallbackWithTimeout(parsedFarmId, farm.crop.crop_name, symptom, farmerPhoneNumber);

        } catch (error) {
            console.error("[RuleEngine Critical Error]:", error.message);
            return { success: false, diagnosis: "Hitilafu ya Mfumo", recommendation: "Jaribu tena baadae kidogo." };
        }
    }

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

        return {
            success: true,
            show_on_menu: true,
            diagnosis: rule.diagnosis,
            recommendation: rule.recommendation,
            log_id: savedLog.log_id || savedLog.id
        };
    }

    async handleAiFallbackWithTimeout(farmId, cropName, symptom, phoneNumber) {
        console.log(`[RuleEngine]: Maneno hayapo kwenye sheria za ndani. Inatafuta Local Context & Inaita Gemini AI...`);

        // Vuta muktadha wa ndani (Local RAG Context)
        const localContext = await this.findLocalContext(symptom);
        let contextText = "";
        if (localContext) {
            contextText = `Muktadha: Zao la ${cropName} lina tatizo linalohusiana na ${localContext.symptom_keyword}. Ushauri wetu wa ndani: ${localContext.recommendation}`;
        }

        try {
            // Kupiga AI (Tunapitisha context sasa hivi kusaidia Gemini asikwame)
            const aiResult = await runWithTimeout(
                geminiService.askUssdFallback(cropName, `${symptom}. ${contextText}`), 
                this.AI_TIMEOUT_MS
            );
            
            if (aiResult) {
                const savedLog = await prisma.advisoryLog.create({
                    data: {
                        farm_id: farmId,
                        reported_symptom: symptom,  
                        rawSymptomQuery: symptom,   
                        diagnosis: aiResult.diagnosis,
                        recommendation: aiResult.recommendation,
                        source: "USSD_GEMINI_FAST"
                    }
                });

                if (phoneNumber) {
                    smsService.sendAdvisorySms(phoneNumber, aiResult).catch(err => console.error("❌ SMS Error (Fast AI):", err.message));
                }

                return {
                    success: true,
                    show_on_menu: false,
                    diagnosis: aiResult.diagnosis,
                    recommendation: aiResult.recommendation,
                    log_id: savedLog.log_id || savedLog.id
                };
            }
        } catch (error) {
            console.warn("[RuleEngine]: AI imezidi muda au ina hitilafu. Inahamishiwa background processing...");
            
            // Washa mchakato wa chini chini - TUMEONDOA KOSA LA VARIABLE
            this.executeLongRunningAiProcess(farmId, cropName, symptom, phoneNumber, localContext).catch(err => {
                console.error("[Background AI Async Error]:", err.message);
            });

            return {
                success: true,
                show_on_menu: false, 
                diagnosis: "Uchambuzi wa AI Unaendelea",
                recommendation: "Mifumo yetu inachakata changamoto hii kupitia AI kwa sasa. Utatumiwa ujumbe mfupi (SMS) wenye majibu sahihi ya ugonjwa, dozi na dawa kwenye simu yako ndani ya muda mfupi. Ahsante!"
            };
        }
    }

    async executeLongRunningAiProcess(farmId, cropName, symptom, phoneNumber, localContext) {
        try {
            let aiResult;
            let contextText = localContext ? `Ushauri wa Ndani: ${localContext.recommendation}` : "";

            try {
                // Kujaribu kupiga Gemini kwa mazingira ya nyuma
                aiResult = await geminiService.askUssdFallback(cropName, `${symptom}. ${contextText}`);
            } catch (geminiError) {
                console.error(`[Gemini SMS Fallback Error]: ${geminiError.message}`);
                // UKIKUTANA NA 429 AU 503: Kama kuna localContext, itumie hiyo hiyo badala ya kufeli!
                if (localContext) {
                    aiResult = {
                        diagnosis: localContext.diagnosis || "Changamoto ya Zao",
                        recommendation: localContext.recommendation
                    };
                } else {
                    throw geminiError; // Hakuna data ya ndani, rusha kosa kwenda kwenye catch kuu
                }
            }
            
            if (!aiResult) throw new Error("Gemini na Local DB zote zimeshindwa kurudisha jibu.");

            let finalDiagnosis = "Ushauri wa Jumla";
            let finalRecommendation = "Kagua shamba lako au wasiliana na afisa ugani.";

            if (typeof aiResult === 'object' && aiResult !== null) {
                finalDiagnosis = aiResult.diagnosis || "Ushauri wa Kilimo";
                finalRecommendation = aiResult.recommendation || "Kagua shamba.";
            } else if (typeof aiResult === 'string') {
                finalRecommendation = aiResult;
            }

            //SULUHISHO: `farmId` sasa ni dynamic, na `symptomKeyword` imerekebishwa kuwa `symptom`
            await prisma.advisoryLog.create({
                data: {
                    farm_id: farmId, 
                    reported_symptom: symptom.substring(0, 190),
                    rawSymptomQuery: symptom.substring(0, 190),
                    diagnosis: String(finalDiagnosis), 
                    recommendation: String(finalRecommendation),
                    source: "USSD_GEMINI_BACKGROUND"
                }
            });

            //SULUHISHO: Tumeondoa duplicate ya `smsService.sendAdvisorySms`
            if (phoneNumber) {
                await smsService.sendAdvisorySms(phoneNumber, {
                    diagnosis: finalDiagnosis,
                    recommendation: finalRecommendation
                });
                console.log(`[Background AI]: SMS ya majibu halisi imetumwa salama kwa ${phoneNumber}`);
            }

        } catch (err) {
            console.error("[Background AI Critical Failure]:", err.message);
            if (phoneNumber) {
                await smsService.sendAdvisorySms(phoneNumber, {
                    diagnosis: "Uchunguzi Haukukamilika",
                    recommendation: "Tafadhali andika dalili za zao lako kwa kutumia maneno mepesi au wasiliana na afisa ugani wa karibu."
                }).catch(e => console.error("SMS Fallback Error:", e.message));
            }
        }
    }
}

module.exports = new RuleEngineService();