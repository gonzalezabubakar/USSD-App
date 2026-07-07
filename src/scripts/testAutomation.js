// src/scripts/testAutomation.js
require('dotenv').config(); 
const automationService = require('../services/knowledgeAutomation.service');

async function runTest() {
    console.log("🚀 [TEST]: Inawasha mtambo mkuu wa kutengeneza Context Cache Google AI Studio...");
    console.time("Muda Uliotumika"); 

    try {
        // 🛠️ Hapa sasa tunapiga function inayopakua, kusoma na KURUSHA kule Google!
        const success = await automationService.refreshGeminiContextCache();
        
        if (success) {
            console.log("\n🎉 [USPRINGI WA AFRIKA]: Kazi imekwisha! Data ziko Google AI Studio na USSD ikipiga inapata majibu papo hapo!");
        } else {
            console.log("\n⚠️ [Mkwamo]: Mchakato umeisha lakini hakuna kitu kilichotumwa.");
        }
    } catch (error) {
        console.error("\n❌ [PORT CRASH]: Hitilafu kubwa imetokea:", error.message);
    } finally {
        console.timeEnd("Muda Uliotumika");
        process.exit(0); 
    }
}

runTest();