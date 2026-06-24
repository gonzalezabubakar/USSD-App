// src/controllers/ussd.controller.js
const prisma = require('../config/prisma');

exports.handleUssd = async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    let response = '';
    const textArray = text === '' ? [] : text.split('*');

    try {
        // 1. ANGAZIA KAMA MKULIMA YUPO KWENYE DATABASE
        const farmer = await prisma.farmer.findUnique({
            where: { phone_number: phoneNumber }
        });

        // =================================================================
        // MFUMO A: MKULIMA HAJASAJILIWA (MTIRIRIKO WA USAJILI)
        // =================================================================
        if (!farmer) {
            if (textArray.length === 0) {
                response = `CON Karibu! Namba yako haijasajiliwa.
1. Jisajili kama Mkulima mpya`;
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
        // MFUMO B: MKULIMA AMESHASAJILIWA (MENYU KUU YA HUDUMA)
        // =================================================================
        else {
            // Jina la kwanza la mkulima kwa ajili ya salamu
            const firstName = farmer.full_name.split(' ')[0];

            if (textArray.length === 0) {
                // HATUA YA 0: Menyu ya Mkulima Aliyesajiliwa
                response = `CON Karibu tena, ${firstName}!
                    1. Sajili Shamba Mpya
                    2. Omba Ushauri wa Kilimo (AI)`;
            } 
            
            // -------------------------------------------------------------
            // NJIA YA 1: KUSAJILI SHAMBA
            // -------------------------------------------------------------
            else if (textArray[0] === '1') {
                if (textArray.length === 1) {
                    // HATUA YA 1: Chagua Zao (Hapa unaweza kuweka meza ya mazao baadae)
                    response = `CON Chagua aina ya Zao:
                        1. Mahindi
                        2. Mpunga
                        3. Maharagwe`;
                } else if (textArray.length === 2) {
                    // HATUA YA 2: Ukubwa wa Shamba
                    response = `CON Weka ukubwa wa shamba (kwa Ekari):`;
                } else if (textArray.length === 3) {
                    // HATUA YA 3: Kuhifadhi Data
                    const cropSelection = textArray[1]; // '1', '2', au '3'
                    const farmSize = parseFloat(textArray[2]);

                    // Ramani ya ID za mazao (Hakikisha ID hizi zipo kwenye meza yako ya Crop)
                    // Mfano: ID 1 = Mahindi, ID 2 = Mpunga, ID 3 = Maharagwe
                    let cropId = 1; 
                    let cropName = "Mahindi";
                    if (cropSelection === '2') { cropId = 2; cropName = "Mpunga"; }
                    if (cropSelection === '3') { cropId = 3; cropName = "Maharagwe"; }

                    // Kabla ya kuunda Farm, hakikisha zao lipo kwenye database ili kuzuia Foreign Key Error
                    await prisma.crop.upsert({
                        where: { crop_id: cropId },
                        update: {},
                        create: { crop_id: cropId, crop_name: cropName }
                    });

                    // Hifadhi Shamba jipya kwenye database
                    await prisma.farm.create({
                        data: {
                            farmer_id: farmer.farmer_id,
                            crop_id: cropId,
                            farm_size: farmSize
                        }
                    });

                    response = `END Umefanikiwa kusajili shamba la ${cropName} lenye ukubwa wa ekari ${farmSize}. Ahsante!`;
                }
            } 
            
            // -------------------------------------------------------------
            // NJIA YA 2: EXPERT SYSTEM / AI ADVISORY (Inakuja)
            // -------------------------------------------------------------
            else if (textArray[0] === '2') {
                response = `END Huduma ya AI ya utambuzi wa magonjwa inatengenezwa sasa hivi.`;
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