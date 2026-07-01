// src/tasks/proactiveAlerts.js
const prisma = require('../config/prisma');
const aiAdvisorService = require('../services/aiAdvisor.service');

exports.checkAndSendProactiveAlerts = async () => {
    // 1. Angalia kama kuna mlipuko (Cluster Detection)
    // Mfano: Tafuta advisory logs zote za siku 3 zilizopita, kisha group kwa mkoa na ugonjwa
    const recentLogs = await prisma.advisoryLog.groupBy({
        by: ['region', 'diagnosis', 'crop_id'],
        _count: { log_id: true },
        where: { created_at: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } } // Siku 3 zilizopita
    });

    for (const cluster of recentLogs) {
        // Kama wakulima zaidi ya 5 wa Wilaya/Mkoa mmoja wamelalamikia ugonjwa huo huo (mfano: Maize Streak au Lethal Necrosis)
        if (cluster._count.log_id >= 5) {
            
            // 2. Pata wakulima wote wa mkoa huo wanaolima zao hilo ambao bado hawajaleta malalamiko
            const endangeredFarmers = await prisma.farmer.findMany({
                where: {
                    region: cluster.region,
                    farms: { some: { crop_id: cluster.crop_id } }
                    // Hapa unaweza ku-exclude wale ambao tayari wameshaleta logs za ugonjwa huu
                },
                include: { farms: { where: { crop_id: cluster.crop_id }, include: { crop: true } } }
            });

            // 3. Watumie SMS za tahadhari zilizotengenezwa na Gemini kulingana na ukubwa wa mashamba yao!
            for (const farmer of endangeredFarmers) {
                const farm = farmer.farms[0];
                
                // Tunatengeneza data ya nje (feki au halisi kutoka TMA API)
                const externalData = { weather_forecast: "Unyevunyevu ni mkubwa, hali inayoruhusu ugonjwa kusambaa kwa kasi." };
                const ruleResult = { 
                    diagnosis: cluster.diagnosis, 
                    recommendation: "Nyunyizia dawa ya kuzuia wadudu wanaoeneza virusi na ng'oa mimea ya mwanzo yenye mistari." 
                };

                // Piga akili ya Gemini itengeneze SMS ya kijanja
                const personalizedSms = await aiAdvisorService.generatePersonalizedAdvice({
                    farmerData: farmer,
                    farmData: farm,
                    ruleResult: ruleResult,
                    externalData: externalData,
                    userStyle: 'LOW_AWARENESS' // Unairahisisha kwa sababu ni tahadhari ya ujumla
                });

                // Hapa unamrushia SMS kupitia Africa's Talking
                // smsService.send(farmer.phone_number, personalizedSms);
                console.log(`Tahadhari imetumwa kwa ${farmer.full_name} wa ekari ${farm.farm_size} mkoa wa ${cluster.region}`);
            }
        }
    }
};