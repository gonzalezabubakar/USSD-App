// src/services/sms.service.js
require('dotenv').config();

const africastalking = require('africastalking')({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME
});
const sms = africastalking.SMS;
const { limitMessageLength } = require('../utils/string.util'); // Vuta spana hapa!

class SmsService {
    async sendAdvisorySms(phoneNumber, diagnosisResult) {
        try {
            if (!phoneNumber) throw new Error("Namba ya simu haijapatikana.");

            let cleanedPhone = String(phoneNumber).trim();
            if (cleanedPhone.startsWith('0')) cleanedPhone = '255' + cleanedPhone.substring(1);
            if (!cleanedPhone.startsWith('+')) cleanedPhone = '+' + cleanedPhone;

            if (cleanedPhone.length < 12) return null;

            // Template yetu safi
            let rawMessage = `Ndugu mkulima,\n` +
                             `ugonjwa ni ${diagnosisResult.diagnosis}\n` +
                             `fata ushauri huu ${diagnosisResult.recommendation}\n` +
                             `Asante.`;

            // UTUMIAJI WA UTILS: Rahisi, Safi na Inatabirika!
            const finalMessage = limitMessageLength(rawMessage, 160);

            console.log(`[SmsService]: Inatuma SMS (Herufi: ${finalMessage.length}) kwenda ${cleanedPhone}...`);

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