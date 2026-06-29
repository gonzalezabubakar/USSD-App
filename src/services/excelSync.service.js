// src/services/excelSync.service.js
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const EXCEL_PATH = path.join(__dirname, '../data/rules.xlsx');
const BACKUP_JSON_PATH = path.join(__dirname, '../data/rules.json');

// Kikomo cha mabadiliko kabla ya kuruhusu DB i-update (Mistari 5)
const CHANGE_THRESHOLD = 5; 

class ExcelSyncService {
    /**
     * Inatengeneza alama ya vidole (MD5 Hash) ya faili ili kujua kama limeguswa
     */
    getFileHash(filePath) {
        if (!fs.existsSync(filePath)) return null;
        const fileBuffer = fs.readFileSync(filePath);
        return crypto.createHash('md5').update(fileBuffer).digest('hex');
    }

    /**
     * Mfumo mkuu wa kukagua na kusawazisha Excel
     */
    async checkAndProcessRules(isEmergency = false) {
        console.log("[SyncEngine]: Inakagua mabadiliko ya sheria kutoka kwenye Excel...");

        if (!fs.existsSync(EXCEL_PATH)) {
            console.log("⚠️ [SyncEngine]: Excel haipo, mfumo unatumia DB iliyopo sasa.");
            return;
        }

        const currentHash = this.getFileHash(EXCEL_PATH);
        const existingMeta = await prisma.fileMeta.findUnique({
            where: { fileName: 'rules.xlsx' }
        });

        // Kama hash inafanana, hakuna kilichobadilika kabisa
        if (existingMeta && existingMeta.lastMd5 === currentHash) {
            console.log("⚡ [SyncEngine]: Excel haijabadilika. Mfumo upo sawa!");
            return;
        }

        try {
            const workbook = xlsx.readFile(EXCEL_PATH);
            const sheetName = workbook.SheetNames[0];
            const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

            // MABADILIKO: Kutengeneza rule_id kutokana na Row Number ya Excel
            const freshExcelRules = rawData.map((row, index) => ({
                rule_id: index + 2, // index 0 inakuwa Row 2 kwenye Excel
                crop_name: String(row.crop_name || "").trim().toLowerCase(),
                symptom_keyword: String(row.symptom_keyword || "").trim().toLowerCase(),
                diagnosis: String(row.diagnosis || "").trim(),
                recommendation: String(row.recommendation || "").trim()
            }));

            // Soma Backup ya JSON ya zamani kuhesabu mabadiliko
            let currentJsonRules = [];
            if (fs.existsSync(BACKUP_JSON_PATH)) {
                currentJsonRules = JSON.parse(fs.readFileSync(BACKUP_JSON_PATH, 'utf-8'));
            }

            let changeCount = 0;

            // Hesabu mabadiliko ya ndani ya mistari au mistari mipya
            freshExcelRules.forEach(freshRule => {
                const oldRule = currentJsonRules.find(r => r.rule_id === freshRule.rule_id);
                if (!oldRule) {
                    changeCount++;
                } else if (
                    oldRule.crop_name !== freshRule.crop_name ||
                    oldRule.symptom_keyword !== freshRule.symptom_keyword ||
                    oldRule.diagnosis !== freshRule.diagnosis ||
                    oldRule.recommendation !== freshRule.recommendation
                ) {
                    changeCount++;
                }
            });

            // Angalia kama kuna mistari imefutwa
            if (currentJsonRules.length > freshExcelRules.length) {
                changeCount += (currentJsonRules.length - freshExcelRules.length);
            }

            console.log(`📊 [SyncEngine]: Mabadiliko yaliyopo kwa sasa ni: [${changeCount}]`);

            // AMRI YA KUSUKUMA KWENYE DATABASE
            if (isEmergency) {
                console.log("🚨 [SyncEngine]: DHARURA! Inasafisha na ku-update Database sasa hivi...");
                await this.applyUpdatesToDatabase(freshExcelRules, currentHash, 0);
            } 
            else if (changeCount >= CHANGE_THRESHOLD) {
                console.log(`📈 [SyncEngine]: Mabadiliko yamefika kikomo [${changeCount} >= ${CHANGE_THRESHOLD}]. Inasasisha Database...`);
                await this.applyUpdatesToDatabase(freshExcelRules, currentHash, 0);
            } 
            else {
                // Kama mabadiliko ni kidogo, yanatunzwa kwenye JSON tu, DB haitishwi!
                fs.writeFileSync(BACKUP_JSON_PATH, JSON.stringify(freshExcelRules, null, 2));
                
                await prisma.fileMeta.upsert({
                    where: { fileName: 'rules.xlsx' },
                    update: { pending_changes: changeCount },
                    create: { fileName: 'rules.xlsx', lastMd5: currentHash, pending_changes: changeCount }
                });

                console.log(`⏳ [SyncEngine]: Mabadiliko yamehifadhiwa kwenye JSON Backup pekee. Database haijaguswa.`);
            }

        } catch (error) {
            console.error("❌ [SyncEngine Error]:", error.message);
        }
    }

    /**
     * Kazi ya kuandika rasmi kwenye Database mabadiliko yanapokubalika
     */
    async applyUpdatesToDatabase(rules, fileHash, pendingChanges) {
        fs.writeFileSync(BACKUP_JSON_PATH, JSON.stringify(rules, null, 2));
        const excelIds = rules.map(r => r.rule_id);

        for (const rule of rules) {
            if (!rule.crop_name || !rule.symptom_keyword) continue;
            await prisma.expertRule.upsert({
                where: { rule_id: rule.rule_id },
                update: {
                    crop_name: rule.crop_name,
                    symptom_keyword: rule.symptom_keyword,
                    diagnosis: rule.diagnosis,
                    recommendation: rule.recommendation
                },
                create: rule
            });
        }

        // Futa sheria zilizofutwa kabisa kwenye Excel
        await prisma.expertRule.deleteMany({
            where: { rule_id: { notIn: excelIds } }
        });

        // Weka sawa Metadata
        await prisma.fileMeta.upsert({
            where: { fileName: 'rules.xlsx' },
            update: { lastMd5: fileHash, pending_changes: pendingChanges },
            create: { fileName: 'rules.xlsx', lastMd5: fileHash, pending_changes: pendingChanges }
        });

        console.log("🔥 [SyncEngine]: Database imesasishwa kikamilifu kwa usalama.");
    }
}

module.exports = new ExcelSyncService();