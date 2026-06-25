// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Inasoma Knowledge Base kutoka kwenye faili la JSON...');
  
  // Tafuta faili ya JSON lilipo
  const jsonPath = path.join(__dirname, 'knowledge_base.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const expertRules = JSON.parse(rawData);

  console.log(`Zimepatikana sheria ${expertRules.length}. Zinasafirishwa kwenda MySQL kwenye model ya ExpertRule...`);

  // Kusukuma data moja baada ya nyingine kwenye database
  for (const item of expertRules) {
    await prisma.expertRule.create({
      data: {
        symptom_keyword: item.symptom_keyword.toLowerCase(), // Inahifadhi kwa herufi ndogo kurahisisha search
        diagnosis: item.diagnosis,
        recommendation: item.recommendation
      }
    });
  }

  console.log('Data zote zimeingia kwenye model ya ExpertRule');
}

main()
  .catch((e) => {
    console.error('Hitilafu wakati wa kuingiza data:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });