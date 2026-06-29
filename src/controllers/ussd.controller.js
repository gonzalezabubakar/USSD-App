// src/controllers/ussd.controller.js
const prisma = require('../config/prisma');
const ruleEngine = require('../services/ruleEngine.service');
const smsService =  require('../services/sms.service');
const farmHistoryService = require('../services/farmHistory.service'); // <<< 1. INGIZA SERVICE MPYA HAPA

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
                
                // 2. IINGIZE LOGIC HAPA: Baada ya kuchagua shamba (textArray.length === 2)
                else {
                    const selectedIndex = parseInt(textArray[1]) - 1;
                    if (selectedIndex < 0 || selectedIndex >= farmer.farms.length) {
                        response = `END Chaguo la shamba si sahihi. Anza upya.`;
                    } else {
                        const chosenFarm = farmer.farms[selectedIndex];
                        
                        // Kagua kama shamba lina ripoti ya ndani ya siku 14
                        const farmHistory = await farmHistoryService.getRecentFarmHistory(chosenFarm.farm_id);

                        // CHAGUO A: SHAMBA LINA HISTORIA YA KARIBUNI
                        if (farmHistory) {
                            if (textArray.length === 2) {
                                // Mpe ujumbe wa maendeleo ya shamba
                                response = `CON Shamba lako Wiki iliyopita lilitambuliwa kuwa na ${farmHistory.diagnosis} \n\nJe, hali ikoje sasa?\n1. Bado tatizo lipo (Andika dalili upya)\n2. Shamba limepona kabisa \n3. Kusoma ushauri uliopita`;
                            } 
                            // Mkulima amejibu menu ya historia (textArray.length === 3)
                            else if (textArray.length === 3) {
                                const historyChoice = textArray[2];

                                if (historyChoice === '1') {
                                    // Option 1: Bado linaumwa -> Mwambie aandike dalili mpya
                                    response = `CON Andika kwa kifupi dalili unazoona kwa sasa:`;
                                } else if (historyChoice === '2') {
                                    // Option 2: Limepona kabisa -> Sasisha (Siri) na toa ujumbe wa pongezi
                                    await farmHistoryService.markAsResolved(farmHistory.log_id);
                                    response = `END Hongera sana, ${firstName}! Tunakutakia mavuno mema kwenye shamba lako la ${chosenFarm.crop.crop_name}.`;
                                } else if (historyChoice === '3') {
                                    // Option 3: Kusoma ushauri wa dawa uliopita
                                    response = `END USHAURI ULIOPITA:\nUgonjwa: ${farmHistory.diagnosis}\nUshauri: ${farmHistory.recommendation}`;
                                } else {
                                    response = `END Chaguo si sahihi. Anza upya.`;
                                }
                            }
                            // Mkulima ameandika dalili mpya baada ya kuchagua '1' (textArray.length === 4)
                            else if (textArray.length === 4 && textArray[2] === '1') {
                                const reportedSymptom = textArray[3];
                                const result = await ruleEngine.diagnoseAndLog(chosenFarm.farm_id, reportedSymptom);
                                
                                // smsService.sendAdvisorySms(phoneNumber, result).catch(err => console.error(err.message));
                                response = `END Ugonjwa: ${result.diagnosis}\nUshauri: ${result.recommendation}`;
                            } else {
                                response = `END Chaguo si sahihi. Anza upya.`;
                            }
                        } 
                        
                        // CHAGUO B: SHAMBA HALINA HISTORIA (Mtiririko wako wa asili)
                        else {
                            if (textArray.length === 2) {
                                response = `CON Andika kwa kifupi dalili unazoona kwenye mmea (Mfano: madoa ya manjano, majani kukauka):`;
                            } else if (textArray.length === 3) {
                                const reportedSymptom = textArray[2];
                                const result = await ruleEngine.diagnoseAndLog(chosenFarm.farm_id, reportedSymptom);
                                
                                 smsService.sendAdvisorySms(phoneNumber, result).catch(err => console.error(err.message));
                                response = `END Ugonjwa: ${result.diagnosis}\nUshauri: ${result.recommendation}`;
                            }
                        }
                    }
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