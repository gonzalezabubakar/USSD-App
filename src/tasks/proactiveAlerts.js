// src/tasks/proactiveAlerts.js
const prisma = require('../config/prisma');
const aiAdvisorService = require('../services/aiAdvisor.service');
const smsService = require('../services/sms.service');

/**
 * Inashughulikia ugunduzi wa milipuko ya kweli kwa kusoma 
 */
exports.checkAndSendProactiveAlerts = async () => {
    console.log(`\n[Alert System] Mkaguzi wa Milipuko umeanza rasmi kupitia Database...`);

    // 1. VUTA DATA ZOTE TANGU SIKU 3 ZILIZOPITA ZIKIWA NA MAHUSIANO YAKE
    const logs = await prisma.advisoryLog.findMany({
        where: {
            created_at: { 
                gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // Siku 3 zilizopita
            }
        },
        include: {
            farm: {
                include: {
                    farmer: true, // Ili tupate mkoa halisi (farm.farmer.region)
                    crop: true    // Ili tupate zao halisi (farm.crop_id)
                }
            }
        }
    });

    console.log(`[Alert System] Idadi ya ripoti (logs) zilizopatikana kwenye DB kwa siku 3: ${logs.length}`);

    if (logs.length === 0) {
        console.log("Hakuna malalamiko yoyote mapya (Advisory Logs) yaliyoingizwa kwenye database ndani ya siku 3 zilizopita.");
        return;
    }

    // 2. MANUAL GROUPING ENGINE
    const clusters = {};

    logs.forEach(log => {
        if (!log.farm || !log.farm.farmer) return;

        const mkoa = log.farm.farmer.region;
        const ugonjwa = log.diagnosis;
        const zaoId = log.farm.crop_id;

        // Kama ripoti haina mkoa au ugonjwa, iruke
        if (!mkoa || !ugonjwa || !zaoId) return;

        // (Unique Cluster Key)
        const key = `${mkoa}_${ugonjwa}_${zaoId}`;

        if (!clusters[key]) {
            clusters[key] = {
                region: mkoa,
                diagnosis: ugonjwa,
                crop_id: zaoId,
                count: 0
            };
        }
        clusters[key].count += 1;
    });

    // 3. KUCHAKATA KILA MLIPUKO ULIOPATIKANA
    for (const key in clusters) {
        const cluster = clusters[key];

        // Kama mkoa mmoja una ripoti kuanzia 5 au zaidi za ugonjwa huo huo
        if (cluster.count >= 2) {
            console.log(`MLIPUKO WA KWELI UMEGUNDULIKA! Mkoa: ${cluster.region} | Ugonjwa: ${cluster.diagnosis} | Ripoti: ${cluster.count}`);

            // 4. VUTA WAKULIMA WOTE WA MKOA HUO WANAOLIMA ZAO HILO KUTOKA KWENYE DB
            const endangeredFarmers = await prisma.farmer.findMany({
                where: {
                    region: cluster.region,
                    farms: {
                        some: {
                            crop_id: cluster.crop_id 
                        }
                    }
                },
                include: {
                    farms: {
                        where: { crop_id: cluster.crop_id },
                        include: { crop: true }
                    }
                }
            });

            console.log(`Idadi ya wakulima walio hatarini mkoani ${cluster.region} wanaotumiwa SMS: ${endangeredFarmers.length}`);

            // 5. KUTUMA SMS ZILIZOPITISHWA KWENYE GEMINI AI
            for (const farmer of endangeredFarmers) {
                const farm = farmer.farms[0];
                if (!farm) continue;

                const externalData = { 
                    weather_forecast: `Hali ya sasa mkoani ${cluster.region} ina unyevunyevu unaochochea kuenea kwa ugonjwa huu.` 
                };
                
                const ruleResult = { 
                    diagnosis: cluster.diagnosis, 
                    recommendation: "Nyunyizia dawa ya kudhibiti visumbufu, na ng'oa mimea ya mwanzo iliyoathirika ili kulinda shamba lako." 
                };

                console.log(`Gemini anasoma wasifu wa: ${farmer.full_name} (${farm.farm_size} Ekari)...`);

                try {
                    // Piga akili ya Gemini
                    const personalizedSms = await aiAdvisorService.generatePersonalizedAdvice({
                        farmerData: farmer,
                        farmData: farm,
                        ruleResult: ruleResult,
                        externalData: externalData,
                        userStyle: 'LOW_AWARENESS'
                    });

                    console.log(`Inarusha SMS kwenda kwa: ${farmer.full_name} (${farmer.phone_number})`);

                    // Tuma SMS kupitia huduma yako ya Africa's Talking
                    await smsService.sendAdvisorySms(farmer.phone_number, {
                        diagnosis: cluster.diagnosis,
                        recommendation: personalizedSms
                    });

                    console.log(`Imewasilishwa kikamilifu kwa ${farmer.full_name}!`);

                } catch (aiError) {
                    console.error(`Hitilafu ilitokea kwa mkulima ${farmer.full_name}:`, aiError.message);
                }
            }
        } else {
            console.log(`Kikundi cha [${cluster.region} - ${cluster.diagnosis}] kina ripoti ${cluster.count}, hakijafikia kiwango cha mlipuko (kiwango ni kuanzia 5).`);
        }
    }
    console.log("Mzunguko mzima wa ukaguzi umekamilika bila hitilafu.");
};