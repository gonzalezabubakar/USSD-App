
const cron = require('node-cron');

const app = require('./src/app'); 
const excelSyncService = require('./src/services/excelSync.service');
const proactiveAlerts = require('./src/tasks/proactiveAlerts');
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`USSD server running on port  ${PORT}`);
    
    // 1. Hangalia taadhari
    cron.schedule('0 8 * * *', async () => {
        try {
            await proactiveAlerts.checkAndSendProactiveAlerts();
        } catch (error) {
            console.error("[Cron Error] Imefeli:", error.message);
        }
    });

    // 2. Kusoma Excel file
    excelSyncService.syncExcelToDatabase()
        .then(() => console.log("[Boot Sync]: Ukaguzi wa Excel umekamilika."))
        .catch(err => console.error("[Boot Sync Error]:", err.message));
});