// src/services/sms.service.js
require('dotenv').config();

const africastalking = require('africastalking')({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME
});
const sms = africastalking.SMS;
const { limitMessageLength } = require('../utils/string.util');

class SmsService {
    async sendAdvisorySms(phoneNumber, diagnosisResult) {
        try {
            if (!phoneNumber) throw new Error("Namba ya simu haijapatikana.");

            let cleanedPhone = String(phoneNumber).trim();
            if (cleanedPhone.startsWith('0')) cleanedPhone = '255' + cleanedPhone.substring(1);
            if (!cleanedPhone.startsWith('+')) cleanedPhone = '+' + cleanedPhone;

            if (cleanedPhone.length < 12) return null;

            const diagnosis = diagnosisResult?.diagnosis || "";
            const recommendation = diagnosisResult?.recommendation || "";
            const source = diagnosisResult?.source || "";

            let rawMessage = "";

            const niUjumbeWaDharuraAuJumla = 
                source === "SYSTEM_FALLBACK" || 
                source === "GEMINI_GENERAL_ADVICE" || 
                diagnosis.includes("Uchunguzi") || 
                diagnosis.includes("Tatizo la") ||
                diagnosis.includes("Ushauri");

            if (niUjumbeWaDharuraAuJumla) {
                // Ushauri ghafi wa haraka usio na lebo za kishule
                rawMessage = recommendation;
            } else if (recommendation.includes("TAHADHARI")) {
                rawMessage = recommendation;
            } else {
                // Kama ni ugonjwa uliothibitishwa, weka kwa ufupi wa hali ya juu
                rawMessage = `Zao lina ${diagnosis}. ${recommendation}`;
            }

            //TUNALAZIMISHA: Hapa ujumbe wote unakatwa kwa weledi usizidi herufi 130!
            // Hii itabadilisha gazeti kuwa "Ushauri wa Huduma ya Kwanza" na kuweka wito wa kuendeleza chat.
            const finalMessage = limitMessageLength(rawMessage, 130);

            console.log(`[SmsService]: Inatuma SMS fupi (Herufi: ${finalMessage.length}) kwenda ${cleanedPhone}...`);

            const response = await sms.send({
                to: [cleanedPhone], 
                message: finalMessage
            });

            console.log("[SmsService]: SMS imetumwa salama!", response);
            return response;
        } catch (error) {
            console.error("SmsService Error:", error.message);
            return null; 
        }
    }
}

module.exports = new SmsService();