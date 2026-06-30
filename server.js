const app = require('./src/app'); 
const excelSyncService = require('./src/services/excelSync.service');

const PORT = process.env.PORT || 3000;


app.listen(PORT, async () => {
    console.log(`USSD server running on port  ${PORT}`);
    
    // road EXCEL file
     excelSyncService.syncExcelToDatabase()
        .then(() => console.log("[Boot Sync]: Ukaguzi na ulinganishaji wa Excel umekamilika."))
        .catch(err => console.error("[Boot Sync Error]:", err.message));
});