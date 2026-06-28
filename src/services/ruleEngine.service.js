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
        console.log("[Database Sync]: Inasawazisha sheria...");
        
        // MTEGO: Angalia kama kuna data yoyote iliyosomwa kutoka kwenye Excel/JSON
        console.log("[Mtego wa Excel Data]: Data zilizopo ndani ya memory ni:", this.rules);

        if (!this.rules || this.rules.length === 0) {
            console.log("[Onyo]: Hakuna sheria zilizopatikana kwenye memory! Excel au JSON inaweza ikawa tupu.");
            return;
        }

        try {
            const upsertPromises = this.rules.map(rule => {
                return prisma.expertRule.upsert({
                    where: { symptom_keyword: rule.symptom_keyword },
                    update: {
                        crop_name: rule.crop_name, // Hakikisha na hii ipo kama umeongeza zao!
                        diagnosis: rule.diagnosis,
                        recommendation: rule.recommendation
                    },
                    create: {
                        crop_name: rule.crop_name,
                        symptom_keyword: rule.symptom_keyword,
                        diagnosis: rule.diagnosis,
                        recommendation: rule.recommendation
                    }
                });
            });

            await prisma.$transaction(upsertPromises);
            console.log(`[Database Sync Success]: Sheria zote zimesawazishwa!`);
        } catch (error) {
            console.error("[Database Sync Error]:", error.message);
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
     * Kusoma dalili za mkulima, kutafuta ugonjwa kwa ZAO HUSIKA LA SHAMBA,
     * na kuhifadhi ripoti kamili kwenye database (AdvisoryLog).
     * * @param {number} farmId - ID ya shamba la mkulima linalokaguliwa
     * @param {string} symptom - Sentensi au maneno aliyoandika mkulima kutoka USSD
     */
    async diagnoseAndLog(farmId, symptom) {
        console.log(`🔍 [RuleEngine]: Inatafuta zao la Shamba ID: ${farmId} kuanza ukaguzi yakinifu...`);
        
        try {
            // 1. TAFUTA ZAO LA SHAMBA HILI (Kutoka kwenye database)
            const farm = await prisma.farm.findUnique({
                where: { farm_id: parseInt(farmId) },
                include: { crop: true } // Inavuta data kutoka jedwali la Crop
            });

            if (!farm) {
                throw new Error(`Shamba lenye ID ${farmId} halikupatikana kwenye database.`);
            }

            // Pata jina la zao na ulifanye kuwa herufi ndogo ili kuzuia migongano
            const currentCropName = (farm.crop ? farm.crop.crop_name : (farm.crop_name || "")).toLowerCase().trim();
            console.log(`[RuleEngine]: Shamba lililotambuliwa ni la zao la: "${currentCropName}"`);

            if (!currentCropName) {
                throw new Error(`Shamba hili halina aina ya zao iliyosajiliwa.`);
            }

            // 2. KUSAFISHA MANENO ALIYOANDIKA MKULIMA KWENYE USSD
            const cleanedSymptom = symptom.toLowerCase().trim();
            // Vunja sentensi ya mkulima kuwa maneno na uondoe maneno mafupi (kama "kwa", "ya", "na")
            const farmerWords = cleanedSymptom.split(/\s+/).filter(w => w.length > 2);

            // 3. VUTA SHERIA KUTOKA DATABASE ZINAZOHUSU ZAO HILI TU 
            // Hapa ndipo tunapozuia dalili za Mahindi zisiingiliane na za Nyanya au Mpunga!
            const dbRules = await prisma.expertRule.findMany({
                where: {
                    crop_name: currentCropName
                }
            });

            console.log(`[RuleEngine]: Zimepatikana sheria ${dbRules.length} kule database zinazohusu zao la "${currentCropName}" pekee.`);

            let matchedRule = null;
            let highestScore = 0;

            // 4. UCHAMBUZI YAKINIFU (Kupiga hesabu ya mfanano wa maneno kwa zao hili tu)
            for (const rule of dbRules) {
                // Vunja maneno ya 'symptom_keyword' ya sheria hii kutoka database
                const ruleWords = rule.symptom_keyword
                    .replace(/,/g, ' ') // Geuza mikato kuwa nafasi
                    .toLowerCase()
                    .split(/\s+/)
                    .filter(w => w.length > 2);

                let currentScore = 0;

                // Linganisha neno kwa neno kati ya mkulima na database
                farmerWords.forEach(fWord => {
                    ruleWords.forEach(rWord => {
                        if (rWord.includes(fWord) || fWord.includes(rWord)) {
                            currentScore += 1; // Ongeza alama kama neno limegusa
                        }
                    });
                });

                // Tafuta ile sheria yenye uzito mkubwa zaidi
                if (currentScore > highestScore && currentScore > 0) {
                    highestScore = currentScore;
                    matchedRule = rule;
                }
            }

            // 5. ANDAA MAJIBU YA MFUMO
            const finalDiagnosis = matchedRule ? matchedRule.diagnosis : "Ugonjwa haukutambulika mara moja";
            const finalRecommendation = matchedRule ? matchedRule.recommendation : `Dalili hizi hazikupata mfanano thabiti kwenye zao la ${currentCropName}. Taarifa imetumwa kwa Afisa Ugani.`;

            console.log(`[Uchambuzi Yakinifu]: Alama: ${highestScore} | Ugonjwa -> ${finalDiagnosis}`);

            // 6. HIFADHI RIPOTI KWENYE DATABASE (AdvisoryLog)
            const savedLog = await prisma.advisoryLog.create({
                data: {
                    farm_id: parseInt(farmId),
                    reported_symptom: symptom,
                    diagnosis: finalDiagnosis,
                    recommendation: finalRecommendation,
                    source: "USSD"
                }
            });

            console.log(`[AdvisoryLog]: Ripoti imehifadhiwa kwa ID: ${savedLog.log_id}`);

            // 7. REJESHA DATA KWENYE USSD ROUTE
            return {
                success: true,
                diagnosis: finalDiagnosis,
                recommendation: finalRecommendation,
                log_id: savedLog.log_id
            };

        } catch (error) {
            console.error("[RuleEngine Critical Error]:", error.message);
            return {
                success: false,
                diagnosis: "Hitilafu ya Uchambuzi",
                recommendation: "Mfumo umepata kigugumizi wakati wa kuchambua zao. Tafadhali jaribu tena baadae."
            };
        }
    }
}

module.exports = new RuleEngineService();