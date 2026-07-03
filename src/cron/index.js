// src/cron/index.js
const initExcelCronJob = require('./excelSync.cron');
const initAlertsCronJob = require('./proactiveAlerts.cron');

const initAllCronJobs = () => {
   // console.log("[Cron System]: Inapakia ratiba zote");
    
    // Washa kazi ya Excel
    initExcelCronJob();
    
    // Washa kazi ya Alerts
    initAlertsCronJob();
    
  //  console.log("[Cron System]: Ratiba zote zimepatikana");
};

module.exports = { initAllCronJobs };