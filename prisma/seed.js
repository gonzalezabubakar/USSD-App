// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('⚡ [Seed]: Inasoma sheria mpya kutoka kwenye faili la JSON...');
  
  // Tunasoma 'rules.json' iliyotengenezwa kutoka kwenye rules.xlsx
  // Inatafuta faili lililopo kwenye src/data/rules.json au popote lilipo
  const jsonPath = path.join(__dirname, '../src/data/rules.json');
  
  // Kama rules.json haipo hapo, inarudi kusoma knowledge_base.json ya dharura
  let finalPath = jsonPath;
  if (!fs.existsSync(jsonPath)) {
    console.log('[Onyo]: rules.json haijapatikana, inatumia knowledge_base.json ya dharura...');
    finalPath = path.join(__dirname, 'knowledge_base.json');
  }

  const rawData = fs.readFileSync(finalPath, 'utf-8');
  const expertRules = JSON.parse(rawData);

  console.log(`Zimepatikana sheria ${expertRules.length}. Zinasafirishwa kwenda MySQL...`);

  // 2. Kusukuma data moja baada ya nyingine kwenye database
  for (const item of expertRules) {
    
    // Kama neno la ugonjwa au jina la zao halipo, tunazuia kosa
    const crop = item.crop_name || item.crop || 'mahindi';
    const keyword = item.symptom_keyword || item.keyword || '';

    if (!keyword) {
      console.log(`Ruka mstari usio na symptom_keyword kwa zao la: ${crop}`);
      continue; // Inaruka mstari kama hauna neno la dalili ili isivunje database
    }

    await prisma.expertRule.create({
      data: {
        // Tunahakikisha crop_name na keyword zinakaa kwa herufi ndogo zilingane na USSD logic
        crop_name: crop.toLowerCase().trim(),
        symptom_keyword: keyword.toLowerCase().trim(), 
        diagnosis: item.diagnosis || 'Ugonjwa haujulikani',
        recommendation: item.recommendation || 'Wasiliana na afisa ugani wa karibu.'
      }
    });
  }

  console.log('[Seed Success]: Data zote zimesawazishwa vizuri kwenye table ya ExpertRule!');
}

main()
  .catch((e) => {
    console.error('Hitilafu kubwa wakati wa kuingiza data:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });