// src/controllers/admin.controller.js
const excelSyncService = require('../services/excelSync.service');

class excelSyncServiceController {
    /**
     * Inalazimisha mabadiliko ya Excel kwenda kwenye DB kwa dharura
     */
    async forceEmergencySync(req, res) {
        try {
            console.log("[excelSyncServiceController]: Ombi la dharura la ku-sync limepokelewa.");
            
            // Tunapitisha true kuashiria isEmergency
            await excelSyncService.checkAndProcessRules(true); 
            
            return res.status(200).json({ 
                success: true, 
                message: "Database imesasishwa kwa hali ya dharura kikamilifu!" 
            });
        } catch (error) {
            console.error("[excelSyncServiceController Error]:", error.message);
            return res.status(500).json({ 
                success: false, 
                error: "Imeshindikana kufanya dharura ya sync.",
                details: error.message 
            });
        }
    }
}

// Export instance ya Controller tayari kwa matumizi
module.exports = new excelSyncServiceController();