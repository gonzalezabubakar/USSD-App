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
     * Kusoma dalili za mkulima, kutafuta ugonjwa kwa zao husika kwa kutumia Multiple Keywords,
     * na kuhifadhi ripoti kamili kwenye database (AdvisoryLog).
     * 
     * @param {number} farmId - ID ya shamba la mkulima linalokaguliwa
     * @param {string} symptom - Sentensi au maneno aliyoandika mkulima kutoka USSD
     */
    async diagnoseAndLog(farmId, symptom) {
        console.log(`[Database Log]: Inatafuta zao la Shamba ID: ${farmId} ili kuanza ukaguzi...`);
        
        try {
            // 1. TAFUTA ZAO LA SHAMBA HILI (Kutoka kwenye database)
            // Tunahitaji kupata jina la zao (crop_name) ili tuchuje sheria za zao husika tu
            const farm = await prisma.farm.findUnique({
                where: { farm_id: parseInt(farmId) },
                include: { crop: true } // Hakikisha una include uhusiano wa table ya crop kama ipo
            });

            if (!farm) {
                throw new Error(`Shamba lenye ID ${farmId} halikupatikana kwenye database.`);
            }

            // Kuchukua jina la zao (Kama huna table ya crop na jina lipo moja kwa moja kwenye farm, tumia farm.crop_name)
            const currentCropName = farm.crop ? farm.crop.crop_name : (farm.crop_name || "");
            console.log(`[RuleEngine]: Shamba linashughulikia zao la: ${currentCropName}`);

            // 2. KUSAFISHA MANENO YA MKULIMA
            const cleanedSymptom = symptom.toLowerCase().trim();
            let matchedRule = null;

            if (currentCropName) {
                // 3. TAFUTA SHERIA KWA KUZINGATIA ZAO NA MANENO MENGI YA SIRI (Multiple Keywords)
                matchedRule = this.rules.find(rule => {
                    // A) Thibitisha kama sheria hii ya Excel ni ya zao hili la mkulima
                    const isCorrectCrop = rule.crop_name.toLowerCase() === currentCropName.toLowerCase();
                    if (!isCorrectCrop) return false;

                    // B) Tenga maneno ya siri ya Excel yaliyotenganishwa kwa mkato (kama: "njano, kukauka")
                    const keywordsArray = rule.symptom_keyword
                        .split(',')
                        .map(k => k.trim().toLowerCase())
                        .filter(k => k !== ''); // Ondoa nafasi zilizo wazi

                    // C) Angalia kama HATA NENO MOJA kati ya hayo limo ndani ya sentensi ya mkulima
                    const hasMatchingKeyword = keywordsArray.some(keyword => {
                        return cleanedSymptom.includes(keyword);
                    });

                    return hasMatchingKeyword;
                });
            }

            // 4. ANDAA MAJIBU YA MFUMO YA KUREJESHA USSD
            const finalDiagnosis = matchedRule ? matchedRule.diagnosis : "Ugonjwa haukutambulika mara moja";
            const finalRecommendation = matchedRule ? matchedRule.recommendation : "Dalili za mmea hazipo kwenye kanunidata zetu za sasa. Taarifa imetumwa kwa Afisa Ugani wa eneo lako.";

            console.log(`[Diagnosis Result]: Ugonjwa -> ${finalDiagnosis}`);
            console.log(`[Database Log]: Inahifadhi matokeo ya ukaguzi wa Shamba ID: ${farmId} kwenye AdvisoryLog...`);

            // 5. HIFADHI KWENYE DATABASE (AdvisoryLog) - Imeboreshwa kurekebisha 'source is missing' error
            const savedLog = await prisma.advisoryLog.create({
                data: {
                    farm_id: parseInt(farmId),
                    reported_symptom: symptom,
                    diagnosis: finalDiagnosis,
                    recommendation: finalRecommendation,
                    source: "USSD" // Inalingana na schema yako sasa hivi herufi kwa herufi!
                }
            });

            console.log(`[Database Log Success]: Log ya ukaguzi imehifadhiwa kwa ID: ${savedLog.log_id}`);

            // 6. REJESHA DATA KWENYE CONTROLLER/USSD ROUTE
            return {
                success: true,
                diagnosis: finalDiagnosis,
                recommendation: finalRecommendation,
                log_id: savedLog.log_id
            };

        } catch (error) {
            console.error("[RuleEngine Diagnose & DB Error]:", error.message);
            
            // Rejesha muundo wa dharura (Fallback) ili USSD isicrash na ionyeshe Hitilafu ya Mfumo
            return {
                success: false,
                diagnosis: "Hitilafu ya Mfumo",
                recommendation: "Tafadhali jaribu tena baadae kidogo au wasiliana na msaada wa kiufundi."
            };
        }
    }
}

module.exports = new RuleEngineService();