const prisma = require('../config/prisma');
const ruleEngine = require('../services/ruleEngine.service');
const smsService =  require('../services/sms.service');
const farmHistoryService = require('../services/farmHistory.service');
const { getHumanReadableTime } = require('../utils/timeFormatter'); // Mahesabu ya muda pekee

exports.handleUssd = async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    let response = '';
    const textArray = text === '' ? [] : text.split('*');

    try {
        // 1. ANGAZIA KAMA MKULIMA YUPO KWENYE DATABASE
        const farmer = await prisma.farmer.findUnique({
            where: { phone_number: phoneNumber },
            include: { farms: { include: { crop: true } } } 
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
            // CHAGUO 1: KUSAJILI SHAMBA (PAMOJA NA ZAO JINGINE)
            // -------------------------------------------------------------
            else if (textArray[0] === '1') {
                if (textArray.length === 1) {
                    response = `CON Chagua aina ya Zao:\n1. Mahindi\n2. Mpunga\n3. Maharagwe\n99. Zao Jingine`;
                } 
                
                else if (textArray.length === 2 && textArray[1] === '99') {
                    response = `CON Andika jina la zao lako (Mfano: Nyanya, Alizeti):`;
                }

                else if ((textArray.length === 2 && textArray[1] !== '99') || (textArray.length === 3 && textArray[1] === '99')) {
                    response = `CON Weka ukubwa wa shamba (kwa Ekari):`;
                } 

                else {
                    let cropName = "";
                    let farmSizeInput = "";

                    if (textArray[1] === '99') {
                        cropName = String(textArray[2]).trim();
                        farmSizeInput = textArray[3];
                    } else {
                        if (textArray[1] === '1') cropName = "Mahindi";
                        else if (textArray[1] === '2') cropName = "Mpunga";
                        else if (textArray[1] === '3') cropName = "Maharagwe";
                        farmSizeInput = textArray[2];
                    }

                    const farmSize = parseFloat(farmSizeInput);

                    if (!cropName || isNaN(farmSize)) {
                        response = `END Data uliyoingiza si sahihi. Jaribu tena.`;
                    } else {
                        const cleanCropName = cropName.toLowerCase();
                        
                        let crop = await prisma.crop.findFirst({
                            where: { crop_name: cleanCropName }
                        });

                        if (!crop) {
                            crop = await prisma.crop.create({
                                data: { crop_name: cleanCropName }
                            });
                        }

                        await prisma.farm.create({
                            data: { 
                                farmer_id: farmer.farmer_id, 
                                crop_id: crop.crop_id, 
                                farm_size: farmSize 
                            }
                        });

                        const formattedCropName = cropName.charAt(0).toUpperCase() + cropName.slice(1);
                        response = `END Umefanikiwa kusajili shamba la ${formattedCropName} lenye ukubwa wa ekari ${farmSize}. Ahsante!`;
                    }
                }
            } 
            
            // -------------------------------------------------------------
            // CHAGUO 2: OMBA USHAURI WA KILIMO (EXPERT SYSTEM)
            // -------------------------------------------------------------
            else if (textArray[0] === '2') {
                if (farmer.farms.length === 0) {
                    response = `END Samahani, huna shamba lililosajiliwa kwenye mfumo. Tafadhali sajili shamba kwanza ili upate ushauri wa ugonjwa sahihi.`;
                } 
                
                else if (textArray.length === 1) {
                    let farmList = `CON Chagua Shamba lako:\n`;
                    farmer.farms.forEach((farm, index) => {
                        const formattedName = farm.crop.crop_name.charAt(0).toUpperCase() + farm.crop.crop_name.slice(1);
                        farmList += `${index + 1}. Shamba la ${formattedName} (${farm.farm_size} Ekari)\n`;
                    });
                    response = farmList;
                } 
                
                else {
                    const selectedIndex = parseInt(textArray[1]) - 1;
                    if (selectedIndex < 0 || selectedIndex >= farmer.farms.length) {
                        response = `END Chaguo la shamba si sahihi. Anza upya.`;
                    } else {
                        const chosenFarm = farmer.farms[selectedIndex];
                        const farmHistory = await farmHistoryService.getRecentFarmHistory(chosenFarm.farm_id);

                        // CHAGUO A: SHAMBA LINA HISTORIA YA KARIBUNI
                        if (farmHistory) {
                            if (textArray.length === 2) {
                                // Hapa tunapiga hesabu za uhalisia wa muda uliopita
                                const timeAgo = getHumanReadableTime(farmHistory.created_at);

                                response = `CON ${timeAgo}, shamba hili lilitambuliwa kuwa na ${farmHistory.diagnosis}\n\nJe, hali ikoje sasa?\n1. Bado tatizo lipo (Andika dalili upya)\n2. Shamba limepona kabisa \n3. Kusoma ushauri uliopita`;
                            } 
                            else if (textArray.length === 3) {
                                const historyChoice = textArray[2];

                                if (historyChoice === '1') {
                                    response = `CON Andika kwa kifupi dalili unazoona kwa sasa:`;
                                } else if (historyChoice === '2') {
                                    await farmHistoryService.markAsResolved(farmHistory.log_id);
                                    const formattedName = chosenFarm.crop.crop_name.charAt(0).toUpperCase() + chosenFarm.crop.crop_name.slice(1);
                                    response = `END Hongera sana, ${firstName}! Tunakutakia mavuno mema kwenye shamba lako la ${formattedName}.`;
                                } else if (historyChoice === '3') {
                                    response = `END USHAURI ULIOPITA:\nUgonjwa: ${farmHistory.diagnosis}\nUshauri: ${farmHistory.recommendation}`;
                                } else {
                                    response = `END Chaguo si sahihi. Anza upya.`;
                                }
                            }
                            else if (textArray.length === 4 && textArray[2] === '1') {
                                const reportedSymptom = textArray[3];
                                const result = await ruleEngine.diagnoseAndLog(chosenFarm.farm_id, reportedSymptom);
                                response = `END Ugonjwa: ${result.diagnosis}\nUshauri: ${result.recommendation}`;
                            } else {
                                response = `END Chaguo si sahihi. Anza upya.`;
                            }
                        } 
                        
                        // CHAGUO B: SHAMBA HALINA HISTORIA
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