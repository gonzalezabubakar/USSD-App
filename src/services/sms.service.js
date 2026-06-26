// src/services/sms.service.js
require('dotenv').config();


const africastalking = require('africastalking')({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME
});
const sms = africastalking.SMS;

class SmsService {
    /**
     * Inatuma ushauri wa ugonjwa kwenda kwa mkulima kupitia SMS
     * @param {string} phoneNumber - Namba ya simu ya mkulima (+255...)
     * @param {object} diagnosisResult - Jibu lililotoka kwenye RuleEngine ({ diagnosis, recommendation })
     */
    async sendAdvisorySms(phoneNumber, diagnosisResult) {
        try {
            // Hapa ndipo unapo-control muundo na lugha ya ujumbe wako kwa urahisi (Template)
            const message = `Habari Ndugu Mkulima, ripoti yako ya ukaguzi wa shamba:\n\n` +
                            `• UGONJWA: ${diagnosisResult.diagnosis}\n` +
                            `• USHAURI: ${diagnosisResult.recommendation}\n\n` +
                            `Asante kwa kutumia Mfumo wetu wa Kilimo Ushauri.`;

            console.log(` SmsService, Inajaribu kutuma SMS kwenda ${phoneNumber}...`);

            const response = await sms.send({
                to: [phoneNumber],
                message: message,
                // senderId: process.env.AT_SENDER_ID // Kama unayo kutoka TCRA
            });

            console.log("SmsService, SMS imetumwa salama!", response);
            return response;
        } catch (error) {
            // Hata kama SMS ikifeli, hatutaki i-crash mfumo mzima wa USSD
            console.error("SmsService Error Hitilafu wakati wa kutuma SMS:", error.message);
            return null; 
        }
    }
}

module.exports = new SmsService();