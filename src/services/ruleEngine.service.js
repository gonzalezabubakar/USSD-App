// src/services/ruleEngine.service.js
const prisma = require('../config/prisma');

class RuleEngineService {
    async diagnoseAndLog(farmId, reportedSymptom, source = "USSD") {
        try {
            // 1. Leta data ya shamba na zao lililolimwa
            const farm = await prisma.farm.findUnique({
                where: { farm_id: parseInt(farmId) },
                include: { crop: true }
            });

            if (!farm) throw new Error("Shamba halikupatikana");

            // 2. Leta sheria zote kutoka kwenye meza yetu mpya ya ExpertRule
            const rules = await prisma.expertRule.findMany();
            
            let matchedRule = null;
            const lowerSymptom = reportedSymptom.toLowerCase();

            // 3. Tafuta ugonjwa kulingana na neno kuu lililoandikwa na mkulima
            for (const rule of rules) {
                const keyword = rule.symptom_keyword.toLowerCase();
                if (lowerSymptom.includes(keyword)) {
                    matchedRule = rule;
                    break;
                }
            }

            let diagnosis = "Ugonjwa haujatambulika";
            let recommendation = `Tafadhali wasiliana na Afisa Ugani wa karibu kwa ukaguzi wa shamba lako la ${farm.crop.crop_name}.`;

            if (matchedRule) {
                diagnosis = matchedRule.diagnosis;
                recommendation = matchedRule.recommendation;
            }

            // 4. HISTORIA: Hifadhi tukio hili kwenye meza yako ya advisory_logs kulingana na schema
            // (Hapa tunajaza farm_id, reported_symptom, final_advice n.k.)
            await prisma.advisoryLog.create({
                data: {
                    farm_id: parseInt(farmId),
                    rule_id: matchedRule ? matchedRule.rule_id : null,
                    reported_symptom: reportedSymptom,
                    final_advice: `[Ugonjwa]: ${diagnosis}. [Tiba]: ${recommendation}`
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