// src/cron/proactiveAlerts.cron.js
const cron = require('node-cron');
const proactiveAlerts = require('../tasks/proactiveAlerts.js');

const initAlertsCronJob = () => {
    // Kila siku saa 8:00 Asubuhi
    cron.schedule('0 8 * * *', async () => {
        console.log("[Cron Job]: Inaanza kuangalia na kutuma tahadhari asubuhi...");
        try {
            await proactiveAlerts.checkAndSendProactiveAlerts();
            console.log("[Cron Job]: Tahadhari zote zimetumwa salama.");
        } catch (error) {
            console.error("[Cron Job Error] Proactive Alerts Imefeli:", error.message);
        }
    });
};

module.exports = initAlertsCronJob;