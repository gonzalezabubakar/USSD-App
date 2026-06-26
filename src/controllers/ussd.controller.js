// src/controllers/ussd.controller.js
const prisma = require('../config/prisma');
const ruleEngine = require('../services/ruleEngine.service');
const smsService =  require('../services/sms.service');


exports.handleUssd = async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    let response = '';
    const textArray = text === '' ? [] : text.split('*');

    try {
        // 1. ANGAZIA KAMA MKULIMA YUPO KWENYE DATABASE
        const farmer = await prisma.farmer.findUnique({
            where: { phone_number: phoneNumber },
            include: { farms: { include: { crop: true } } } // Leta na mashamba yake yote
        });

        // =================================================================
        // MFUMO A: MKULIMA HAJASAJILIWA
        // =================================================================
        if (!farmer) {
            if (textArray.length === 0) {
                response = `CON Karibu! Namba yako haijasajiliwa.\n1. Jisajili kama Mkulima mpya`;
            } else if (textArray[0] === '1') {
                if (textArray.length === 1) {
                    response = `CON Weka Jina lako Kamili (Mfano: Abubakari Shawa):`;
                } else if (textArray.length === 2) {
                    response = `CON Weka Mkoa unaoishi (Mfano: Ruvuma):`;
                } else if (textArray.length === 3) {
                    response = `CON Weka Wilaya unayoishi (Mfano: Songea):`;
                } else if (textArray.length === 4) {
                    const fullName = textArray[1];
                    const region = textArray[2];
                    const district = textArray[3];

                    await prisma.farmer.create({
                        data: {
                            full_name: fullName,
                            phone_number: phoneNumber,
                            region: region,
                            district: district
                        }
                    });
                    response = `END Ahsante ${fullName}! Umefanikiwa kujisajili. Piga tena kodi kufurahia huduma.`;
                }
            } else {
                response = `END Chaguo si sahihi. Tafadhali anza upya.`;
            }
        } 
        
        // =================================================================
        // MFUMO B: MKULIMA AMESHASAJILIWA
        // =================================================================
        else {
            const firstName = farmer.full_name.split(' ')[0];

            if (textArray.length === 0) {
                response = `CON Karibu tena, ${firstName}!\n1. Sajili Shamba Jipya\n2. Omba Ushauri wa Kilimo`;
            } 
            
            // -------------------------------------------------------------
            // CHAGUO 1: KUSAJILI SHAMBA
            // -------------------------------------------------------------
            else if (textArray[0] === '1') {
                if (textArray.length === 1) {
                    response = `CON Chagua aina ya Zao:\n1. Mahindi\n2. Mpunga\n3. Maharagwe`;
                } else if (textArray.length === 2) {
                    response = `CON Weka ukubwa wa shamba (kwa Ekari):`;
                } else if (textArray.length === 3) {
                    const cropSelection = textArray[1];
                    const farmSize = parseFloat(textArray[2]);

                    let cropId = 1; let cropName = "Mahindi";
                    if (cropSelection === '2') { cropId = 2; cropName = "Mpunga"; }
                    if (cropSelection === '3') { cropId = 3; cropName = "Maharagwe"; }

                    await prisma.crop.upsert({
                        where: { crop_id: cropId }, update: {},
                        create: { crop_id: cropId, crop_name: cropName }
                    });

                    await prisma.farm.create({
                        data: { farmer_id: farmer.farmer_id, crop_id: cropId, farm_size: farmSize }
                    });

                    response = `END Umefanikiwa kusajili shamba la ${cropName} lenye ukubwa wa ekari ${farmSize}. Ahsante!`;
                }
            } 
            
            // -------------------------------------------------------------
            // CHAGUO 2: OMBA USHAURI WA KILIMO (EXPERT SYSTEM)
            // -------------------------------------------------------------
            else if (textArray[0] === '2') {
                // Kama hana shamba kabisa, anafukuzwa akasajili shamba kwanza
                if (farmer.farms.length === 0) {
                    response = `END Samahani, huna shamba lililosajiliwa kwenye mfumo. Tafadhali sajili shamba kwanza ili upate ushauri wa ugonjwa sahihi.`;
                } 
                // Hatua ya 1: Onyesha orodha ya mashamba yake
                else if (textArray.length === 1) {
                    let farmList = `CON Chagua Shamba lako:\n`;
                    farmer.farms.forEach((farm, index) => {
                        farmList += `${index + 1}. Shamba la ${farm.crop.crop_name} (${farm.farm_size} Ekari)\n`;
                    });
                    response = farmList;
                } 
                // Hatua ya 2: Mwambie aandike dalili
                else if (textArray.length === 2) {
                    const selectedIndex = parseInt(textArray[1]) - 1;
                    if (selectedIndex < 0 || selectedIndex >= farmer.farms.length) {
                        response = `END Chaguo la shamba si sahihi. Anza upya.`;
                    } else {
                        response = `CON Andika kwa kifupi dalili unazoona kwenye mmea (Mfano: madoa ya manjano, majani kukauka):`;
                    }
                } 
                // Hatua ya 3: Piga Rule Engine, pata ugonjwa, andika log, na upe majibu!
                else if (textArray.length === 3) {
                    const selectedIndex = parseInt(textArray[1]) - 1;
                    const chosenFarm = farmer.farms[selectedIndex];
                    const reportedSymptom = textArray[2]; // Yale maneno mkulima aliyoandika

                    // HAPA TUNAIITA ILE SERVICE YETU MPYA!
                    const result = await ruleEngine.diagnoseAndLog(chosenFarm.farm_id, reportedSymptom);

                    
                    // tuma sms kwa mkulima bila kusubiri mtandoa 
                    //smsService.sendAdvisorySms(phoneNumber, result)
                    //    .catch(err => console.error("USSD async SMS Error", err.message))
                        
                    // Mpe mkulima majibu kwenye simu yake
                    response = `END Ugonjwa ${result.diagnosis}\n Ushauri ${result.recommendation}`;
                }
            } else {
                response = `END Chaguo sio sahihi.`;
            }
        }

    } catch (error) {
        console.error("USSD Error:", error.message);
        response = `END Mfumo una hitilafu kwa sasa. Jaribu tena.`;
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
};