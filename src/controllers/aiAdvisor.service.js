// src/services/aiAdvisor.service.js
const { GoogleGenAI } = require('@google/generative-ai');


exports.generatePersonalizedAdvice = async ({ 
    farmerData, 
    farmData, 
    ruleResult, 
    externalData, 
    userStyle 
}) => {
    
    // 1. Tambua uelewa wa mkulima kulingana na jinsi anavyouliza maswali au profile yake
    let lughaStyle = "rahisi sana, isiyo na maneno magumu ya shule (terms za kitaalamu zijadiliwe kwa mifano)";
    if (userStyle === 'LOW_AWARENESS') {
        lughaStyle = "Lugha ya Kiswahili ya kijijini, mifano ya kawaida, fupi sana, na maelekezo ya hatua kwa hatua ya vitendo.";
    }

    // 2. Jenga Muktadha Madhubuti wa Gemini (System Context)
    const systemInstruction = `
    Wewe ni Mswahili AI, mtaalamu wa ushauri wa kilimo nchini Tanzania. 
    Kazi yako ni kuchukua majibu magumu ya kisayansi na kuyarahisisha ili mkulima ayaelewe na ayatekeleze mara moja.
    
    SHERIA KUU:
    1. USIDANGANYE ugonjwa wala kubadilisha dawa tofauti na ilivyosemwa na Rule Engine. Baki ndani ya mipaka ya kisayansi uliyopewa.
    2. Tafsiri maneno yote ya kitaalamu (mfano: badala ya kusema 'Chlorosis', sema 'majani kupoteza rangi ya kijani na kuwa ya njano').
    3. Unganisha data ya hali ya hewa au eneo kumpa ushauri maalum wa kujikinga.
    `;

    // 3. Jenga mazingira ya data (The Context Payload)
    const prompt = `
    MUKTADHA WA MKULIMA:
    - Jina: ${farmerData.full_name}
    - Eneo: Wilaya ya ${farmerData.district}, Mkoa wa ${farmerData.region}
    - Zao linalozungumziwa: ${farmData.crop.crop_name}
    - Ukubwa wa Shamba: Ekari ${farmData.farm_size}
    
    MATOKEO YA RULE ENGINE (MSINGI WA KISAYANSI - USITOKE NJE YA HAPA):
    - Ugonjwa uliogundulika: ${ruleResult.diagnosis}
    - Suluhisho la kitaalamu: ${ruleResult.recommendation}
    
    DATA YA MAMLAKA ZA NJE (Meteo/Wizara):
    - Hali ya hewa eneo hili kwa sasa: ${externalData.weather_forecast} (Mfano: Kuna unyevunyevu mkubwa na mvua za hapa na pale)
    - Tahadhari ya Kanda: ${externalData.regional_alert || 'Hakuna'}
    
    MIONGOZO YA LUGHA YA MAJIBU:
    - Kiwango cha uelewa wa mkulima: ${lughaStyle}
    - Muundo wa jibu: Jibu liwe fupi, lisipeze herufi 140-160 kwa ajili ya SMS. Toa hatua za haraka.
    
    Tengeneza ujumbe sasa:
    `;

    // Hapa unaita Gemini API yako ukitumia systemInstruction na prompt
    // const response = await geminiModel.generateContent({ ... });
    // return response.text;
    
    return `Mfano wa jibu litakalotoka...`; 
};