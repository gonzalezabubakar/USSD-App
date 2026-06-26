// src/services/ruleEngine.service.js
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const prisma = require('../config/prisma'); // <<< HAPA: Tumeirudisha Prisma kazini!

const excelFilePath = path.join(__dirname, '../data/rules.xlsx');
const jsonFilePath = path.join(__dirname, '../data/rules.json');

class RuleEngineService {
    constructor() {
        this.rules = [];
        this.loadRulesFromExcel();
    }

    /**
     * Kusoma Excel halisi, kutengeneza JSON backup, na KUZISEVU KWENYE DATABASE!
     */
async loadRulesFromExcel() {
        console.log("[RuleEngine]: Inajaribu kusoma sheria kutoka kwenye Excel (.xlsx)...");

        try {
            if (fs.existsSync(excelFilePath)) {
                const workbook = xlsx.readFile(excelFilePath);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawData = xlsx.utils.sheet_to_json(worksheet);

                this.rules = rawData.map(row => ({
                    crop_name: row.crop_name ? row.crop_name.toString().trim() : '',
                    symptom_keyword: row.symptom_keyword ? row.symptom_keyword.toString().trim().toLowerCase() : '',
                    diagnosis: row.diagnosis ? row.diagnosis.toString().trim() : 'Ugonjwa usiojulikana',
                    recommendation: row.recommendation ? row.recommendation.toString().trim() : 'Wasiliana na afisa ugani'
                })).filter(row => row.symptom_keyword !== '');

                console.log(`[RuleEngine]: Sheria ${this.rules.length} zimesomwa kutoka Excel!`);

                // 1. ZUIA NODEMON LOOP (Kwa ajili ya faili la JSON tu)
                let shouldWriteBackup = true;
                if (fs.existsSync(jsonFilePath)) {
                    const existingJsonData = fs.readFileSync(jsonFilePath, 'utf-8');
                    if (existingJsonData === JSON.stringify(this.rules, null, 2)) {
                        shouldWriteBackup = false;
                    }
                }

                if (shouldWriteBackup) {
                    fs.writeFileSync(jsonFilePath, JSON.stringify(this.rules, null, 2), 'utf-8');
                    console.log("[RuleEngine]: Backup ya rules.json imesasishwa.");
                } else {
                    console.log("⏸[RuleEngine]: Hakuna mabadiliko mapya kwenye Excel, JSON haijaandikwa.");
                }
                
                // =======================================================================
                // SULUHISHO: IWEKE HAPA NJE! 
                // Hii inahakikisha kuwa kila server ikirestart, inaenda ku-sync database moja kwa moja
                // =======================================================================
                await this.syncRulesToDatabase();

            } else {
                console.warn("[RuleEngine]: Excel haikupatikana, tunasoma JSON ya dharura...");
                this.loadFromJsonFallback();
            }
        } catch (error) {
            console.error("[RuleEngine Excel Error]:", error.message);
            this.loadFromJsonFallback();
        }
    }
    /**
     * Mfumo salama na wenye Kasi ya Juu (High Performance Sync)
     */
    async syncRulesToDatabase() {
        console.log("[Database Sync]: Inasawazisha sheria kwa kasi ya juu (Bulk Transaction)...");
        const startTime = Date.now();

        try {
            // Badala ya for-loop ya kawaida, tunatengeneza array ya ahadi (Promises)
            const upsertPromises = this.rules.map(rule => {
                return prisma.expertRule.upsert({
                    where: { symptom_keyword: rule.symptom_keyword },
                    update: {
                        diagnosis: rule.diagnosis,
                        recommendation: rule.recommendation
                    },
                    create: {
                        symptom_keyword: rule.symptom_keyword,
                        diagnosis: rule.diagnosis,
                        recommendation: rule.recommendation
                    }
                });
            });

            // Tunaziendesha zote kwa pamoja kwa mkupuo mmoja kwenye database
            await prisma.$transaction(upsertPromises);

            const duration = Date.now() - startTime;
            console.log(`[Database Sync Success]: Sheria ${this.rules.length} zimesawazishwa salama ndani ya ${duration}ms!`);
        } catch (error) {
            console.error("[Database Sync Error]: Kushindwa ku-sync rules:", error.message);
        }
    }
    
    loadFromJsonFallback() {
        try {
            if (fs.existsSync(jsonFilePath)) {
                const jsonData = fs.readFileSync(jsonFilePath, 'utf-8');
                this.rules = JSON.parse(jsonData);
                console.log(`[RuleEngine Fallback]: Sheria ${this.rules.length} zimesomwa kutoka rules.json`);
            } else {
                console.error("[RuleEngine Fatal]: Hata faili la rules.json halipo!");
                this.rules = [
                    { 
                        crop_name: "Mahindi", 
                        symptom_keyword: "kutoboka majani", 
                        diagnosis: "Funza wa Mahindi", 
                        recommendation: "Nyunyizia dawa." 
                    }
                ];
            }
        } catch (error) {
            console.error("[RuleEngine Fallback Error]:", error.message);
        }
    }

    /**
     * Kuchunguza ugonjwa kulingana na aina ya zao na kuandika log kwenye DATABASE halisi!
     */
    async diagnoseAndLog(farmId, userSymptom, currentCropName = "Mahindi") {
        try {
            const cleanedSymptom = userSymptom.trim().toLowerCase();
            const cropTarget = currentCropName.trim().toLowerCase();
            let matchedRule = null;

            // Kutafuta ugonjwa unaoendana kutoka kwenye data za Excel zilizopo kwenye kumbukumbu
            for (const rule of this.rules) {
                const ruleCrop = rule.crop_name.toLowerCase();
                if (ruleCrop === cropTarget && (cleanedSymptom.includes(rule.symptom_keyword) || rule.symptom_keyword.includes(cleanedSymptom))) {
                    matchedRule = rule;
                    break;
                }
            }

            // Kama hakuna dalili iliyolingana
            if (!matchedRule) {
                matchedRule = {
                    diagnosis: "Haukutambulika mara moja",
                    recommendation: `Dalili za mmea wa ${currentCropName} hazipo kwenye kanunidata zetu. Taarifa imetumwa kwa Afisa Ugani.`
                };
            }

            console.log(`[Database Log]: Inahifadhi matokeo ya ukaguzi wa Shamba ID: ${farmId} kwenye Database...`);
            
            // ========================================================================
            // SEHEMU YA DATABASE: Hapa tunatunza log kwenye Table yako ya Inspection au Diagnosis
            // Hakikisha jina la table (mfano: inspectionLog au diagnosisLog) linalingana na schema yako ya Prisma
            // ========================================================================
            await prisma.advisoryLog.create({
                data: {
                    farm_id: farmId,
                    reported_symptom: userSymptom,
                    diagnosis: matchedRule.diagnosis,
                    recommendation: matchedRule.recommendation,
                    source: "USSD" // Kujua kama log imetokea USSD au App
                }
            });

            console.log("[Database Log]: Taarifa imehifadhiwa kikamilifu!");

            return {
                diagnosis: matchedRule.diagnosis,
                recommendation: matchedRule.recommendation
            };

        } catch (error) {
            console.error("[RuleEngine Diagnose & DB Error]:", error.message);
            return {
                diagnosis: "Hitilafu ya Mfumo",
                recommendation: "Tafadhali jaribu tena baadae kidogo."
            };
        }
    }
}

module.exports = new RuleEngineService();