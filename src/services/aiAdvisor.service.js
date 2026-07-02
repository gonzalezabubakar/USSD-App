// src/services/aiAdvisor.service.js
const prisma = require('../config/prisma');
const geminiService = require('./gemini.service');

/**
 * 1. INJINI YA TAHADHARI (PROACTIVE ALERTS) / MAJIBU YA SMS
 * Inasoma na kuratibu jinsi Gemini anavyotakiwa kuandika SMS
 */
exports.generatePersonalizedAdvice = async ({ 
    farmerData, 
    farmData, 
    ruleResult, 
    externalData, 
    userStyle 
}) => {
    try {
        let lughaStyle = "rahisi sana, isiyo na maneno magumu ya shule (terms za kitaalamu zijadiliwe kwa mifano)";
        if (userStyle === 'LOW_AWARENESS') {
            lughaStyle = "Lugha ya Kiswahili ya kijijini, mifano ya kawaida, fupi sana, na maelekezo ya hatua kwa hatua ya vitendo.";
        }

        const systemInstruction = `
        Wewe ni Mswahili AI, mtaalamu wa ushauri wa kilimo nchini Tanzania. 
        Kazi yako ni kuchukua majibu magumu ya kisayansi na kuyarahisisha ili mkulima ayaelewe na ayatekeleze mara moja.
        
        SHERIA KUU:
        1. USIDANGANYE ugonjwa wala kubadilisha dawa tofauti na ilivyosemwa na Rule Engine. Baki ndani ya mipaka ya kisayansi uliyopewa.
        2. Tafsiri maneno yote ya kitaalamu (mfano: badala ya kusema 'Chlorosis', sema 'majani kupoteza rangi ya kijani').
        3. USIWEKE maneno ya ziada kama "Mfano wa jibu:", "Asante", andika SMS ya tahadhari pekee.
        4. Hakikisha ujumbe unaanza na neno "TAHADHARI YA KILIMO!" kwa herufi kubwa.
        `;

        const prompt = `
        MUKTADHA WA MKULIMA:
        - Jina: ${farmerData.full_name}
        - Eneo: Wilaya ya ${farmerData.district}, Mkoa wa ${farmerData.region}
        - Zao linalozungumziwa: ${farmData.crop ? farmData.crop.crop_name : 'Mazao'}
        - Ukubwa wa Shamba: Ekari ${farmData.farm_size}
        
        MATOKEO YA RULE ENGINE:
        - Ugonjwa uliogundulika: ${ruleResult.diagnosis}
        - Suluhisho la kitaalamu: ${ruleResult.recommendation}
        
        DATA YA MAMLAKA ZA NJE:
        - Hali ya hewa eneo hili kwa sasa: ${externalData.weather_forecast}
        - Tahadhari ya Kanda: ${externalData.regional_alert || 'Hakuna'}
        
        MIONGOZO:
        - Kiwango cha uelewa: ${lughaStyle}
        - Muundo: Herufi zisizozidi 140-160 kwa ajili ya SMS. Toa hatua za haraka.
        `;

        const responseText = await geminiService.generateSmsAlert({ systemInstruction, prompt });
        
        if (!responseText) throw new Error("Mtambo wa Gemini haujarudisha ujumbe ghafi.");
        return responseText;

    } catch (error) {
        console.error("[Gemini Proactive Advice Error]:", error.message);
        return `TAHADHARI YA KILIMO! Ndugu ${farmerData.full_name}, kuna ripoti za ugonjwa wa ${ruleResult.diagnosis} katika eneo la ${farmerData.region}. Tafadhali kagua shamba lako la ekari ${farmData.farm_size} na uchukue hatua mapema.`;
    }
};

/**
 * 2. MFUMO WA AUTOMATIC HYBRID ADVISOR (USSD SCREEN & LIVE QUERIES)
 * Inaitwa otomatiki mkulima akiuliza kupitia USSD. Ikikosa kwenye DB inaenda Gemini yenyewe.
 */
exports.askHybridAdvisor = async ({ cropName, symptomKeyword, farmerData, farmData }) => {
    try {
        console.log(`[Hybrid Advisor]: Mkulima ameandika: "${symptomKeyword}"`);

        // =================================================================
        // HATUA YA 1: Kwanza vuta Rules zote za zao hilo zilizopo kwenye DB
        // =================================================================
        const allRulesForCrop = await prisma.expertRule.findMany({
            where: { crop_name: { contains: cropName } }
        });

        // Tengeneza list ya keywords zilizopo kwenye DB yetu kwa sasa
        const availableKeywords = allRulesForCrop.map(r => r.symptom_keyword);

        // =================================================================
        // HATUA YA 2: Muite Gemini kwa siri (Kama Mwamuzi) achambue maana ya sentensi
        // =================================================================
        console.log(`[Hybrid Advisor]: Gemini anachambua maana ya sentensi na kulinganisha na DB Keywords...`);
        
        const geminiModel = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        const classifierPrompt = `
        Wewe ni injini ya lugha (NLP Classifier) kwa ajili ya kilimo nchini Tanzania.
        Mkulima wa zao la "${cropName}" ameeleza tatizo lake hivi: "${symptomKeyword}".
        
        Sisi tuna list ya maneno ya siri (Keywords) kwenye database yetu ambayo ni haya hapa:
        [${availableKeywords.join(", ")}]
        
        MASHARTI YA UAMUZI:
        1. Angalia maana ya jumla ya sentensi ya mkulima. Je, inaendana na Keyword ipi kati ya hizo za database?
        2. Kama inaendana kabisa kwa maana (hata kama ametumia Kiswahili cha tofauti kidogo), rudisha hiyo keyword neno kwa neno.
        3. Kama mkulima amekataa ugonjwa (mfano: "hana madoa ya njano") au sentensi yake haina uhusiano na keyword yoyote, andika neno "HAIPO" pekee.
        4. Jibu lako liwe neno moja tu (Keyword uliyochagua au neno HAIPO). Usiandike sentensi ya ziada wala maelezo!
        `;

        const classifierResult = await geminiModel.generateContent(classifierPrompt);
        const chosenKeyword = classifierResult.response.text().trim();

        console.log(`[Hybrid Advisor Decision]: Gemini amechagua Keyword: "${chosenKeyword}"`);

        // =================================================================
        // HATUA YA 3: Sasa fanya maamuzi kulingana na uamuzi wa Gemini
        // =================================================================
        if (chosenKeyword !== "HAIPO" && availableKeywords.includes(chosenKeyword)) {
            // Gemini amethibitisha kuwa ipo kwenye DB! Tunaitoa DB sasa
            const matchedRule = allRulesForCrop.find(r => r.symptom_keyword === chosenKeyword);
            
            console.log(`✅ [Smart Rule Engine Match]: Uamuzi sahihi kutoka DB: ${matchedRule.diagnosis}`);
            return {
                source: "EXPERT_RULE",
                diagnosis: matchedRule.diagnosis,
                recommendation: matchedRule.recommendation
            };
        }

        // =================================================================
        // HATUA YA 4: Kama Gemini akiona HAIPO kwenye DB, yeye mwenyewe anatoa jibu jipya papo hapo
        // =================================================================
        console.log(`⚠️ [Smart Fallback Mode]: Gemini anaandika jibu jipya kwa sababu hakuna maana inayofanana kwenye DB...`);
        
        const liveResult = await geminiService.askUssdFallback(cropName, symptomKeyword);
        return {
            source: "GEMINI_AI",
            diagnosis: liveResult.diagnosis,
            recommendation: liveResult.recommendation
        };

    } catch (error) {
        console.error("[Smart Hybrid Advisor Error]:", error.message);
        return {
            source: "SYSTEM_FALLBACK",
            diagnosis: `Tatizo la ${cropName}`,
            recommendation: "Kagua shamba vizuri au wasiliana na wataalamu waliopo karibu nawe."
        };
    }
};