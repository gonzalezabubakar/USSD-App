// src/services/aiAdvisor.service.js
const prisma = require('../config/prisma');
const geminiService = require('./gemini.service');

/**
 * MFUMO WA AUTOMATIC HYBRID ADVISOR (GEN-2 MATCH ENGINE)
 * Inatumia Rule IDs + Confidence Scores kudhibiti usahihi wa majibu
 */
exports.askHybridAdvisor = async ({ cropName, symptomKeyword, farmerData, farmData }) => {
    try {
        console.log(`\n[Match Engine]: Swali la Mkulima: "${symptomKeyword}" kwenye zao la ${cropName}`);

        // =================================================================
        // HATUA YA 1: Vuta Rules zote za zao hili kutoka kwenye Database
        // =================================================================
        const allRulesForCrop = await prisma.expertRule.findMany({
            where: { crop_name: { contains: cropName } },
            select: {
                id: true,
                symptom_keyword: true,
                diagnosis: true,
                recommendation: true
            }
        });

        // Kama database haina sheria yoyote ya zao hili (Scenario 3 ya dharura)
        if (allRulesForCrop.length === 0) {
            console.log(`[Match Engine]: Hakuna kabisa sheria za ${cropName} kwenye DB. Tunaenda moja kwa moja AI...`);
            const liveResult = await geminiService.askUssdFallback(cropName, symptomKeyword);
            return {
                source: "GEMINI_AI",
                diagnosis: (liveResult?.diagnosis || `Tatizo la ${cropName}`).replace(/[*#`_\-]/g, ''),
                recommendation: (liveResult?.recommendation || "Kagua shamba vizuri.").replace(/[*#`_\-]/g, '')
            };
        }

        // =================================================================
        // HATUA YA 2: Anda Orodha ya Rules (JSON Format) kwa ajili ya Gemini
        // =================================================================
        const formattedRulesForAi = allRulesForCrop.map((rule, idx) => {
            return `Rule ${idx + 1}\nID: ${rule.id}\nSymptom: ${rule.symptom_keyword}\nDiagnosis: ${rule.diagnosis}\n------------------`;
        }).join("\n");

        // =================================================================
        // HATUA YA 3: Mtengenezee Prompt Kali Gemini ya kufanya Ulinganisho (NLP Match)
        // =================================================================
        const classifierPrompt = `Wewe ni Injini ya Ulinganisho (Match Engine) kwa ajili ya mifumo ya kilimo Tanzania.
Kazi yako ni kuangalia kama maelezo ya mkulima yanafanana na mojawapo ya sheria (Rules) zilizopo kwenye Database yetu.

MAELEZO YA MKULIMA:
Zao: "${cropName}"
Swali/Dalili: "${symptomKeyword}"

ORODHA YA RULES KUTOKA KWENYE DATABASE YETU:
${formattedRulesForAi}

MASHARTI YA MAAMUZI (SCENARIOS):
Scenario 1: Maelezo ya mkulima yanafanana kwa karibu sana au yana maana ileile na Rule iliyopo kwenye DB. Weka confidence kubwa (mfano: 0.80 hadi 0.99).
Scenario 2: Kuna kufanana kidogo sana lakini huna uhakika wa kutosha. Weka match: false na confidence ya chini (chini ya 0.80).
Scenario 3: Hakuna kabisa uhusiano kati ya maelezo ya mkulima na rules zilizopo. Weka match: false na confidence ndogo sana (mfano: 0.10).

LAZIMA urudishe jibu katika muundo huu wa JSON pekee (Bila herufi za ziada au alama za markdown):
{
    "match": true au false,
    "rule_id": weka ID ya sheria iliyofanana (namba) au weka null kama hakuna,
    "confidence": weka kiwango cha uhakika kutoka 0.00 hadi 1.00,
    "reason": "Sura fupi ya kwanini umechagua uamuzi huu"
}`;

        // Piga model ya Gemini kufanya uamuzi wa JSON wa kasi ya juu
        const model = geminiService.ai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        const classifierResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: classifierPrompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1 // Tunaiweka karibu na 0 ili isibabaishe kabisa (Deterministic)
            }
        });

        const rawJson = classifierResult.response.text().trim();
        const decision = JSON.parse(rawJson);

        console.log(`[Gemini Decision]: Match=${decision.match}, Rule_ID=${decision.rule_id}, Confidence=${decision.confidence}`);

        // =================================================================
        // HATUA YA 4: ROUTING LOGIC - Fanya maamuzi kulingana na Confidence Score
        // =================================================================
        
        // SCENARIO 1: Uaminifu ni mkubwa (Confidence ≥ 0.80) -> Vuta jibu halisi la DB
        if (decision.match === true && decision.confidence >= 0.80 && decision.rule_id !== null) {
            
            // Hakikisha hiyo ID ipo kwenye list yetu tuliyoivuta mwanzo
            const matchedRule = allRulesForCrop.find(r => r.id === Number(decision.rule_id));
            
            if (matchedRule) {
                console.log(`[Match Engine]: Imefuzu kwa Confidence ya ${decision.confidence}. Inatumia Expert Rule ID: ${matchedRule.id}`);
                return {
                    source: "EXPERT_RULE",
                    diagnosis: matchedRule.diagnosis,
                    recommendation: matchedRule.recommendation
                };
            }
        }

       // SCENARIO 2 & 3: Confidence ni ndogo (< 0.80) au match ni false -> Angukia kwenye Live AI Advice
        console.log(`[Match Engine]: Confidence ipo chini au Hakuna Match. Inahamia kwenye Fallback ya AI ya Live...`);
        
        // Sasa hivi liveResult itapokea Object yenye { diagnosis, recommendation }
        const liveResult = await geminiService.askUssdFallback(cropName, symptomKeyword);
        
        return {
            source: "GEMINI_AI",
            // Inachukua diagnosis halisi iliyoundwa na AI (Mfano: "Njaa ya mimea mahindini")
            diagnosis: liveResult.diagnosis.replace(/[*#`_\-]/g, ''),
            recommendation: liveResult.recommendation.replace(/[*#`_\-]/g, '')
        };
    } catch (error) {
        console.error("[Smart Hybrid Advisor Critical Error]:", error.message);
        return {
            source: "SYSTEM_FALLBACK",
            diagnosis: `Tatizo la ${cropName}`,
            recommendation: "Kagua shamba vizuri au wasiliana na wataalamu waliopo karibu nawe."
        };
    }
};