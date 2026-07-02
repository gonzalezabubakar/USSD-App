// src/services/gemini.service.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
    constructor() {
        this.ai = process.env.GEMINI_API_KEY
            ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
            : null;
    }

    /**
     * Mapigo ya USSD Fallback
     */
    async askUssdFallback(cropName, symptom) {
        if (!this.ai) {
            console.warn("[Gemini Service]: GEMINI_API_KEY haijasetiwa kwenye .env");
            return this.getFallbackResponse(cropName);
        }

        try {
            console.log(`[Gemini Service]: Inapiga AI USSD Fallback kwa zao la ${cropName}...`);
            
            // 1. REKEBISHO: Tunatumia gemini-2.5-flash ambayo ndiyo stable na inayokubalika sasa
            const model = this.ai.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `Wewe ni Afisa Ugani wa mwenye uwezo na uzoefu wa mika mingi zaidi ya 45 nchini Tanzania. Mkulima wa zao la "${cropName}" ametuma ujumbe huu wa dalili kupitia USSD: "${symptom}".
            Toa utambuzi wa dharura (Diagnosis) na ushauri wa dawa au matibabu (Recommendation).
            
            MASHARTI YA ZIADA:
            1. Jibu kwa Kiswahili rahisi cha kijijini, kifupi sana kinachofaa mkulima kulewa usiari kuhusu aina ya technology anayo tumia.
            2. Usiweke alama za herufi nzito (bold **), nyota, au urembo wowote wa maandishi.
            3. Usiweke salamu (kama "Habari", "Pole"), usilete utangulizi wala mbwembwe.
            4. Muundo wa jibu lako lazima uwe katika JSON format yenye key mbili tu: 'diagnosis' na 'recommendation'.
            5. Jumla ya herufi zote isizidi 130 ili isikate USSD session.

            Muundo wa JSON pekee: {"diagnosis": "Jina la ugonjwa", "recommendation": "Ushauri mfupi ya hatua ya kuchukua"}`;

            const result = await model.generateContent(prompt);
            const rawResponse = result.response.text().trim();
            
            const cleanedJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(cleanedJson);
        } catch (error) {
            console.error("[Gemini Service USSD Fallback Error]:", error.message);
            // 2. ULINZI: API ikifeli, tunarudisha Object halali badala ya null ili kuzuia "Cannot read properties of undefined"
            return this.getFallbackResponse(cropName);
        }
    }

    /**
     * Kutengeneza SMS za Tahadhari (Proactive Alerts)
     */
    async generateSmsAlert({ systemInstruction, prompt }) {
        if (!this.ai) return null;
        try {
            // Tunatumia mabadiliko ya model hapa pia
            const model = this.ai.getGenerativeModel({ 
                model: "gemini-2.5-flash",
                systemInstruction: systemInstruction
            });
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error) {
            console.error("[Gemini Service SMS Alert Error]:", error.message);
            return null;
        }
    }

    /**
     * Hii inasaidia kuzuia crash ya kizamani ya legacy background workers
     */
    async askFallback(cropName, symptom) {
        return this.askUssdFallback(cropName, symptom);
    }

    /**
     * Helper function ya kutoa jibu la dharura mtandao ukikata au API ikigoma
     */
    getFallbackResponse(cropName) {
        return {
            diagnosis: `Tatizo la ${cropName}`,
            recommendation: "Kagua shamba lako vizuri au fika kituo cha pembejeo kilicho karibu nawe kupata msaada."
        };
    }
}

module.exports = new GeminiService();