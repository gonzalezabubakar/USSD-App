// src/cron/excelSync.cron.js
const cron = require('node-cron');
const excelLoader = require('../services/excelSync.service.js');

const initExcelCronJob = () => {
    // Kila siku saa 8:00 Usiku (2:00 AM)
    cron.schedule('0 2 * * *', async () => {
        console.log("[Cron Job]: Inaanza kukagua mabadiliko ya Excel usiku...");
        try {
            await excelLoader.syncExcelToDatabase();
            console.log("[Cron Job]: Excel na Database zimesawazishwa.");
        } catch (error) {
            console.error("[Cron Job Error] Excel Imefeli:", error.message);
        }
    });
};

module.exports = initExcelCronJob;