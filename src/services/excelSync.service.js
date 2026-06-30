// src/services/excelSync.service.js
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const crypto = require('crypto');
const prisma = require('../config/prisma');

class ExcelSyncService {
    constructor() {
        this.DATA_DIR = path.join(__dirname, '../data');
    }

    /**
     * Inatengeneza ID ya kipekee (Hash) kutokana na Zao + Dalili
     */
    generateNaturalKey(cropName, symptomKeyword) {
        const cleanString = `${cropName.trim().toLowerCase()}_${symptomKeyword.trim().toLowerCase()}`;
        return crypto.createHash('md5').update(cleanString).digest('hex');
    }

    async syncExcelToDatabase() {
        console.log("[SmartSync Engine]: Inaanza uchambuzi wa kina wa ma-file ya Excel...");

        if (!fs.existsSync(this.DATA_DIR)) {
            console.log("[SmartSync]: Folda la data halipo.");
            return;
        }

        try {
            const files = fs.readdirSync(this.DATA_DIR)
                .filter(file => file.endsWith('.xlsx') || file.endsWith('.xls'));

            if (files.length === 0) {
                console.log("[SmartSync]: Hakuna faili lolote la Excel foldani.");
                return;
            }

            const currentExcelRuleIds = [];
            let processedRows = 0;

            // 1. Pitia faili moja baada ya jingine 
            for (const file of files) {
                const filePath = path.join(this.DATA_DIR, file);
                const workbook = xlsx.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

                for (const row of rawData) {
                    if (!row.crop_name || !row.symptom_keyword) continue;

                    const cropName = String(row.crop_name).trim().toLowerCase();
                    const symptomKeyword = String(row.symptom_keyword).trim().toLowerCase();
                    const diagnosis = String(row.diagnosis || "").trim();
                    const recommendation = String(row.recommendation || "").trim();

                    // UCHAWI UPO HAPA: ID inatengenezwa kwa jina la zao na dalili pekee
                    const ruleId = this.generateNaturalKey(cropName, symptomKeyword);
                    currentExcelRuleIds.push(ruleId);
                    processedRows++;

                    // 2. UPSERT: Inatofautisha (Mpya, Iliyobadilika, au Iliyopo tayari) kwa kutumia hii ID thabiti
                    await prisma.expertRule.upsert({
                        where: { rule_id: ruleId },
                        update: {
                            // Kama ipo tayari lakini maelezo ya ugonjwa/dawa yamebadilika, inasafisha hapa
                            diagnosis: diagnosis,
                            recommendation: recommendation
                        },
                        create: {
                            // Kama ni mpya kabisa, inaingiza kila kitu hapa
                            rule_id: ruleId,
                            crop_name: cropName,
                            symptom_keyword: symptomKeyword,
                            diagnosis: diagnosis,
                            recommendation: recommendation
                        }
                    });
                }
            }

            // 3. CLEAN UP: Kama kuna ugonjwa ulifutwa kabisa kwenye Excel zote, ufutwe na DB
            const deleteResult = await prisma.expertRule.deleteMany({
                where: { rule_id: { notIn: currentExcelRuleIds } }
            });

            console.log(`[SmartSync Engine]: Uchambuzi umekamilika! Mistari iliyochakatwa: [${processedRows}]. Zilizofutwa DB: [${deleteResult.count}].`);
            return { success: true };

        } catch (error) {
            console.error("[SmartSync Critical Error]:", error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new ExcelSyncService();