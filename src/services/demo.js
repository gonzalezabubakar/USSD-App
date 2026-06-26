// src/services/ruleEngine.service.js
const prisma = require('../config/prisma');

class RuleEngineService {
    async diagnoseAndLog(farmId, reportedSymptom, source = "USSD") {
        try {
            // 1. Leta data ya shamba na zao
            const farm = await prisma.farm.findUnique({
                where: { farm_id: parseInt(farmId) },
                include: { crop: true }
            });

            if (!farm) throw new Error("Shamba halikupatikana.");

            // 2. Leta sheria zote za magonjwa
            const rules = await prisma.expertRule.findMany();
            
            let matchedRule = null;
            const cleanSymptom = reportedSymptom.toLowerCase().trim();

            // ========================================================
            // ADVANCED MATCHING ALGORITHM (TOKENIZATION & SEARCH)
            // ========================================================
            // Tunavunja sentensi ya mkulima kuwa maneno mbalimbali (mfano: ["majani", "ya", "njano"])
            const farmerWords = cleanSymptom.split(/\s+/); 

            for (const rule of rules) {
                const keyword = rule.symptom_keyword.toLowerCase().trim();
                
                // Mbinu A: Angalia kama sentensi nzima ina neno kuu (mfn: "majani ya njano" ina neno "njano")
                if (cleanSymptom.includes(keyword)) {
                    matchedRule = rule;
                    break;
                }

                // Mbinu B: Angalia kama kuna neno lolote lililoandikwa na mkulima linalofanana kwa ukaribu (Husaidia kama kuna herufi zimekosekana kidogo)
                const isWordMatched = farmerWords.some(word => {
                    // Inakamata kama mkulima ameandika "njao" na kwenye database kuna keyword ya "njano" au ukaribu wowote
                    return word.includes(keyword) || keyword.includes(word) && word.length > 3;
                });

                if (isWordMatched) {
                    matchedRule = rule;
                    break;
                }
            }
            // ========================================================

            let diagnosis = "Ugonjwa haujatambulika";
            let recommendation = `Tafadhali wasiliana na Afisa Ugani wa karibu kwa ukaguzi wa shamba lako la ${farm.crop.crop_name}.`;

            if (matchedRule) {
                diagnosis = matchedRule.diagnosis;
                recommendation = matchedRule.recommendation;
            }

            // 3. Hifadhi logi kwenye database
            await prisma.advisoryLog.create({
                data: {
                    farm_id: parseInt(farmId),
                    reported_symptom: reportedSymptom,
                    diagnosis: diagnosis,
                    recommendation: recommendation,
                    source: source
                }
            });

            return { diagnosis, recommendation };

        } catch (error) {
            console.error("Error kwenye RuleEngineService:", error.message);
            throw new Error("Imeshindikana kuchakata ushauri wa kitaalamu.");
        }
    }
}

module.exports = new RuleEngineService();