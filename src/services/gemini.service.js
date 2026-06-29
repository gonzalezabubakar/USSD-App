// src/services/gemini.service.js
// UTATUZI SAHIHI: SDK inatoa darasa kuu linaloitwa GoogleGenAI moja kwa moja
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
    constructor() {
            this.ai = process.env.GEMINI_API_KEY
                ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
                : null;
    }

    /**
     * Kupiga AI Fallback kupata diagnosis na recommendation
     */
    async askFallback(cropName, symptom) {
        if (!this.ai) {
            console.warn("[Gemini Service]: GEMINI_API_KEY haijasetiwa kwenye .env");
            return null;
        }

        try {
            console.log(`[Gemini Service]: Inapiga AI Fallback kwa zao la ${cropName}...`);
            
            // Muundo sahihi wa kuvuta model kutoka kwa GoogleGenAI instance
            const model = this.ai.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `Wewe ni Afisa Ugani wa Kijasusi nchini Tanzania. Mkulima wa zao la "${cropName}" ametuma ujumbe huu wa dalili kupitia USSD: "${symptom}".
            Toa utambuzi wa dharura (Diagnosis) na ushauri wa dawa au matibabu (Recommendation).
            
            MASHARTI:
            1. Jibu kwa Kiswahili rahisi, kifupi sana kinachofaa kwenye skrini ya simu (USSD).
            2. Usiweke alama za herufi nzito (bold **), nyota, au urembo wowote wa maandishi.
            3. Jibu lako liwe katika muundo wa JSON pekee ukitumia key hizi: "diagnosis" na "recommendation".
            4. Jumla ya herufi za 'diagnosis' na 'recommendation' zote zikiunganishwa **ISIZIDI herufi 130**. 
            5. Usiweke salamu (kama "Habari", "Pole"), usilete utangulizi, na usitumie maneno ya mbwembwe.
            6. Muundo wa jibu lako lazima uwe katika JSON format yenye key mbili tu: 'diagnosis' na 'recommendation'.

            Muundo: {"diagnosis": "Jina la ugonjwa", "recommendation": "Ushauri mfupi"}`;

            const result = await model.generateContent(prompt);
            const rawResponse = result.response.text().trim();
            
            // Kusafisha mabano ya vinyororo ya markdown (```json ... ```) kama AI itayaweka
            const cleanedJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
            
            return JSON.parse(cleanedJson);
        } catch (error) {
            console.error("[Gemini Service Error]:", error.message);
            return null;
        }
    }
}

module.exports = new GeminiService();