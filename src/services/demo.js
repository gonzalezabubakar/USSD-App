// src/services/knowledgeAutomation.service.js
const { GOVERNMENT_AGRI_SOURCES } = require('../config/constants');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class KnowledgeAutomationService {
    
    /**
     * INDAO NA KUHIFADHI MA-PDF YA SERIKALI KWENYE DISK YA NDANI
     */
    async downloadAndParseGovDocs() {
        try {
            console.log("[Auto-Downloader]: Inaanza Deep Scraping...");

            // LAZIMISHA FOLDER LITENGENEZWE KWENYE PROJECT ROOT
            const docsDir = path.join(process.cwd(), 'storage', 'agriculture_docs');
            if (!fs.existsSync(docsDir)) {
                fs.mkdirSync(docsDir, { recursive: true });
                console.log(`[Automation]: Folder jipya limetengenezwa hapa: ${docsDir}`);
            }

            for (const institution of GOVERNMENT_AGRI_SOURCES) {
                console.log(`\n[Taasisi]: Inachakata data za ${institution.name}...`);
                
                for (const page of institution.pages) {
                    console.log(`[Kategoria]: Inafungua "${page.category}"...`);
                    
                    try {
                        const response = await axios.get(page.url, { 
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                            timeout: 20000 
                        });
                        
                        const $ = cheerio.load(response.data);
                        const pdfLinks = [];

                        $('a').each((index, element) => {
                            const link = $(element).attr('href');
                            if (link && link.toLowerCase().includes('.pdf')) {
                                const fullLink = link.startsWith('http') ? link : new URL(link, page.url).href;
                                pdfLinks.push(fullLink);
                            }
                        });

                        const latestLinks = pdfLinks.slice(0, 1);
                        console.log(`Zimepatikana PDF ${pdfLinks.length}. Inaanza kupakua...`);

                        for (const pdfUrl of latestLinks) {
                            const safeCategoryName = page.category.replace(/\s+/g, '_');
                            const originalFileName = path.basename(pdfUrl);
                            const finalFileName = `${institution.name}_${safeCategoryName}_${originalFileName}`;
                            const localFilePath = path.join(docsDir, finalFileName);

                            console.log(`Inapakua na Kusave Kwenye Disk: ${finalFileName}...`);
                            
                            const writer = fs.createWriteStream(localFilePath);
                            
                            const pdfResponse = await axios({
                                method: 'get',
                                url: pdfUrl,
                                responseType: 'stream',
                                timeout: 40000
                            });

                            pdfResponse.data.pipe(writer);

                            await new Promise((resolve, reject) => {
                                writer.on('finish', resolve);
                                writer.on('error', reject);
                            });

                            console.log(`Faili Limeshuka na Kuhifadhiwa kwenye Disk salama.`);
                        }

                    } catch (siteError) {
                        console.error(`[Mkwamo kwenye ${page.category}]:`, siteError.message);
                        continue; 
                    }
                }
            }

            return true;
        } catch (error) {
            console.error("[Auto-Downloader Critical Error]:", error.message);
            return false;
        }
    }

    /**
     * INAPAKIA MA-PDF YOTE KWENYE GOOGLE AI STUDIO KAMA FAILI ASILIA (NATIVE FILE API)
     */
    async refreshGeminiContextCache() {
        try {
            // 1. Washa mtambo wa kupakua ma-PDF kwenye disk yetu
            await this.downloadAndParseGovDocs(); 
            
            const docsDir = path.join(process.cwd(), 'storage', 'agriculture_docs');
            
            if (!fs.existsSync(docsDir)) {
                console.log("[Automation]: Folder la kuhifadhi mafile halipo kabisa.");
                return false;
            }

            const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.pdf'));

            if (files.length === 0) {
                console.log("Automation]: Hakuna mafile ya PDF yaliyopatikana kwenye folda.");
                return false;
            }

            console.log(`\n[Automation]: Zimepatikana PDF ${files.length} kwenye disk. Inaanza kupakia Google AI Studio...`);
            
            // 2. Washa Google Gen AI SDK Mpya kabisa
            const { GoogleGenAI } = require('@google/genai');
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

            const uploadedUris = [];

         // LOOP: Tunapita kwenye kila PDF na kulirusha Google kwa njia ya uhakika
            for (const fileName of files) {
                const filePath = path.join(docsDir, fileName);
                
                // 1. Hakikisha ukubwa wa faili uko sawa kabla ya kurusha
                const stats = fs.statSync(filePath);
                if (stats.size === 0) {
                    console.log(`Lilijaribiwa faili tupu, linarukwa: ${fileName}`);
                    continue;
                }

                console.log(`Inapakia faili (${(stats.size / (1024 * 1024)).toFixed(2)} MB): ${fileName}...`);

                // 2. Upakiaji Rasmi kwa kutumia muundo sahihi wa SDK mpya
                const uploadResult = await ai.files.upload({
                    file: filePath,
                    mimeType: 'application/pdf'
                });

                console.log(`Limepakiwa salama! URI: ${uploadResult.uri}`);
                
                // Tunatunza muundo sahihi kwa ajili ya Prisma na Gemini Engine
                uploadedUris.push({
                    fileUri: uploadResult.uri,
                    mimeType: 'application/pdf'
                });
            }

            // 3. Hifadhi Array ya URI zote kwenye Database ya Prisma kama String ya JSON
            const prisma = require('../config/prisma');
            await prisma.systemConfig.upsert({
                where: { key: "active_pdf_uris" },
                update: { value: JSON.stringify(uploadedUris) },
                create: { key: "active_pdf_uris", value: JSON.stringify(uploadedUris) }
            });

            console.log("\n[Automation]: Mfumo umekamilika! URI za ma-PDF yote zimehifadhiwa kwenye DB.");
            return true;

        } catch (error) {
            console.error("[Automation Critical Error]: Imefeli kupakia faili Google:", error.message);
            return false;
        }
    }
}

module.exports = new KnowledgeAutomationService();