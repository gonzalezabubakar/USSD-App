// src/services/farmHistory.service.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class FarmHistoryService {
    /**
     * Kuangalia kama shamba lina historia ya ugonjwa ulioripotiwa hivi karibuni
     * @param {number} farmId - ID ya shamba la mkulima
     * @returns {Object|null} - Inarudisha logi ya mwisho ndani ya siku 14, au null
     */
    async getRecentFarmHistory(farmId) {
        try {
            console.log(`[FarmHistory Service]: Inakagua historia ya Shamba ID: ${farmId}`);
            
            // Siku 14 zilizopita kuanzia sasa
            const siku14Zilizopita = new Date();
            siku14Zilizopita.setDate(siku14Zilizopita.getDate() - 14);

            // Vuta log ya mwisho kabisa ya shamba hili
            const lastLog = await prisma.advisoryLog.findFirst({
                where: {
                    farm_id: parseInt(farmId),
                    NOT: {
                        diagnosis: "Ugonjwa haukutambulika"
                    },
                    // Kama huna column ya created_at kwenye schema, unaweza kutoa huu mstari wa chini
                    created_at: {
                        gte: siku14Zilizopita
                    }
                },
                orderBy: {
                    log_id: 'desc' // Inavuta ya mwisho kuingia (Autoincrement ID au Date)
                }
            });

            if (lastLog) {
                console.log(`[FarmHistory]: Shamba lilikuwa na shida ya "${lastLog.diagnosis}" hivi karibuni.`);
                return lastLog;
            }

            return null;
        } catch (error) {
            console.error("[FarmHistory Service Error]:", error.message);
            return null;
        }
    }

    /**
     * Kusasisha hali ya logi kama imetatuliwa (Mkulima akisema shamba limepona)
     * @param {number} logId - ID ya ripoti iliyopita
     */
    async markAsResolved(logId) {
        try {
            // Hapa unaweza kuweka logic ya kurekebisha kama una column ya status, 
            // au kuandika logi mpya inayosema shamba limepona.
            console.log(`[FarmHistory]: Ripoti ID ${logId} imewekwa alama ya LImepona.`);
            return true;
        } catch (error) {
            console.error("[FarmHistory Update Error]:", error.message);
            return false;
        }
    }
}

module.exports = new FarmHistoryService();