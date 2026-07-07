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
        async askUssdFallback(cropName, symptomKeyword) {
        try {
            if (!this.ai) return this.getFallbackResponse(cropName);

            const systemInstruction = `Wewe ni mtaalamu wa kilimo na daktari wa mimea nchini Tanzania.
Mkulima wa "${cropName}" ameeleza changamoto yake hivi: "${symptomKeyword}".
Hili swali halipo kwenye database yetu ya Expert Rules, hivyo fanya uchunguzi (Diagnosis) wa muda.

SHERIA KALI ZA MUUNDO (JSON ONLY):
1. diagnosis: Uchambue ugonjwa au tatizo hasa kulingana na swali la mkulima. USIANDIKE "Ushauri wa Jumla" wala "Tatizo la ${cropName}". 
   - Mfano kama mkulima kasema "dumaa" au "poteza ukijani", andika "Njaa ya mimea mahindini" au "Upungufu wa Nitrojeni".
   - Kichwa hiki kiwe kifupi mno (Herufi zisizozidi 25) kwa ajili ya safu ya database.
2. sms_content: Huu ni ushauri wa tiba ya haraka utakaenda kwenye simu ya mkulima. 
   - USIANDIKE maneno "Ugonjwa:" au "Tiba:". Tiririsha ujumbe kama ushauri mmoja ulioshikana.
   - UREFU: Usizidi herufi 130. Taja dawa moja au hatua moja kuu ya haraka. Viondoe vipimo kama (10ml/20L).

MUUNDO LAZIMA UWE JSON PEKEE:
{
  "diagnosis": "Kichwa mahususi cha tatizo la mkulima",
  "sms_content": "Ujumbe mfupi ulionyooka wa SMS kwenda kwa mkulima"
}`;

            const prompt = `Zao: ${cropName}. Dalili ya mkulima: "${symptomKeyword}". 
Tengeneza muundo sahihi wa JSON kulingana na maelekezo.`;

            const model = this.ai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.2
                }
            });

            const responseText = result.response.text().trim();
            const cleanData = JSON.parse(responseText);
            
            // Tunarudisha Object nzima sasa hivi ili aiAdvisor.service.js ipate zote mbili
            return {
                diagnosis: cleanData.diagnosis || `Shida ya ${cropName}`,
                recommendation: cleanData.sms_content || "Kagua shamba lako au wasiliana na afisa ugani."
            };

        } catch (error) {
            console.error("[Gemini SMS Fallback Error]:", error.message);
            return this.getFallbackResponse(cropName);
        }
    }
    /**
     * Kutengeneza SMS za Tahadhari (Proactive Alerts)
     */
    async generateSmsAlert({ systemInstruction, prompt }) {
        if (!this.ai) return null;
        try {
            console.log("[Gemini Service]: Inatengeneza SMS Alert...");
            
            const model = this.ai.getGenerativeModel({ 
                model: "gemini-2.5-flash-lite",
                systemInstruction: systemInstruction
            });
            
            // REKEBISHO LA MUUNDO WA GOOGLE SDK HAPA PIA:
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2
                }
            });
            
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