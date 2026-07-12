// src/services/knowledgeAutomation.service.js
const { GOVERNMENT_AGRI_SOURCES } = require('../config/constants');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { MongoClient } = require('mongodb');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { MongoDBAtlasVectorSearch } = require("@langchain/mongodb");
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { Document } = require('@langchain/core/documents');

class KnowledgeAutomationService {
    
    /**
     * TAFUTA NA UPANDE MA-PDF YA SERIKALI KWENYE DISK YA SERVER (OFFLINE/BACKGROUND)
     */
    async downloadAndParseGovDocs() {
        try {
            console.log("📥 [Auto-Downloader]: Inaanza Deep Scraping kwenye tovuti za serikali...");

            const docsDir = path.join(process.cwd(), 'storage', 'agriculture_docs');
            if (!fs.existsSync(docsDir)) {
                fs.mkdirSync(docsDir, { recursive: true });
                console.log(`📂 [Automation]: Folder jipya limetengenezwa hapa: ${docsDir}`);
            }

            for (const institution of GOVERNMENT_AGRI_SOURCES) {
                console.log(`\n🏢 [Taasisi]: Inachakata data za ${institution.name}...`);
                
                for (const page of institution.pages) {
                    console.log(`🌾 [Kategoria]: Inafungua "${page.category}"...`);
                    
                    try {
                        const response = await axios.get(page.url, { 
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                            timeout: 25000 
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

                        // Pakua PDF 1 ya hivi karibuni kabisa kwa kila kategoria ili kulinda space na tokens
                        const latestLinks = pdfLinks.slice(0, 1);
                        console.log(`🔍 Zimepatikana PDF ${pdfLinks.length}. Inaanza kupakua ya kisasa zaidi...`);

                        for (const pdfUrl of latestLinks) {
                            const safeCategoryName = page.category.replace(/\s+/g, '_');
                            const originalFileName = path.basename(pdfUrl);
                            const finalFileName = `${institution.name}_${safeCategoryName}_${originalFileName}`;
                            const localFilePath = path.join(docsDir, finalFileName);

                            console.log(`💾 Inapakua na Kusave: ${finalFileName}...`);
                            
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

                            console.log(`✅ Faili limeshuka vizuri kwenye disk.`);
                        }

                    } catch (siteError) {
                        console.error(`⚠️ [Mkwamo kwenye ${page.category}]:`, siteError.message);
                        continue; 
                    }
                }
            }
            return true;
        } catch (error) {
            console.error("❌ [Auto-Downloader Critical Error]:", error.message);
            return false;
        }
    }

    /**
     * MTAMBO MPYA: INASOMA MA-PDF, INAYAKATA (CHUNKING), INATENGENEZA VECTORS 
     * NA KUZIMWAGA MOJA KWA MOJA MONGODB ATLAS VECTOR SEARCH
     */
    async syncDocsToMongoDBAtlas() {
        const client = new MongoClient(process.env.MONGODB_ATLAS_URI);
        try {
            // 1. Shusha ma-PDF mapya kwanza kutoka serikalini
            const downloadSuccess = await this.downloadAndParseGovDocs();
            if (!downloadSuccess) throw new Error("Scraping ya ma-PDF imefeli.");

            const docsDir = path.join(process.cwd(), 'storage', 'agriculture_docs');
            if (!fs.existsSync(docsDir)) return false;

            const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.pdf'));
            if (files.length === 0) {
                console.log("ℹ️ [Automation]: Hakuna ma-PDF mapya kwenye folda ya kuchakata.");
                return false;
            }

            console.log(`\n🧠 [Vector Pipeline]: Zimepatikana PDF ${files.length}. Inaanza kuziandaa kwa ajili ya MongoDB Atlas...`);
            
            await client.connect();
            const db = client.db("agricultural_advisory_system");
            const collection = db.collection("pdf_knowledge_vectors");

            // REKEBISHO LA MUUNDO WA GOOGLE EMBEDDINGS HAPA:
            const embeddings = new GoogleGenerativeAIEmbeddings({
                apiKey: process.env.GEMINI_API_KEY,
                model: "models/text-embedding-005", // ✅ Alama ya 'model' na njia kamili yenye 'models/'
            });

            // Chombo cha kukata thresholds za herufi
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 600,
                chunkOverlap: 120
            });

            // Loop ya kupita kwenye kila PDF na kuifanyia mabadiliko ya ki-Vector
            for (const fileName of files) {
                const filePath = path.join(docsDir, fileName);
                console.log(`\n⚡ Inachakata faili: ${fileName}`);

                const dataBuffer = fs.readFileSync(filePath);
                const pdfData = await pdfParse(dataBuffer);
                const rawText = pdfData.text;

                if (!rawText || rawText.trim().length === 0) continue;

                const chunks = await textSplitter.splitText(rawText);
                console.log(`🧩 Faili limekatwa vipande ${chunks.length}.`);

                // Smart Routing Detection: Tambua jina la zao kutokana na jina la faili
                let cropName = "Jumla"; 
                const lowerFileName = fileName.toLowerCase();
                if (lowerFileName.includes("mahindi")) cropName = "mahindi";
                else if (lowerFileName.includes("alizeti")) cropName = "alizeti";
                else if (lowerFileName.includes("mpunga")) cropName = "mpunga";
                else if (lowerFileName.includes("maharage")) cropName = "maharage";

                const docs = chunks.map((chunk, index) => {
                    return new Document({
                        pageContent: chunk,
                        metadata: {
                            crop_name: cropName,
                            source: fileName,
                            chunk_id: index,
                            synced_at: new Date()
                        }
                    });
                });

                console.log(`🚀 Inapakia vipande ${docs.length} huko MongoDB Atlas Vector Store...`);
                
                // Sukuma vectors zote Atlas kwa mpigo mmoja
                await MongoDBAtlasVectorSearch.fromDocuments(docs, embeddings, {
                    collection,
                    indexName: "vector_index", 
                    textKey: "content",
                    embeddingKey: "embedding",
                });
                
                // Futa faili la PDF kwenye disk baada ya kulihamishia Atlas salama ili server isijae space
                fs.unlinkSync(filePath);
                console.log(`🗑️ [Safi]: Faili la kienyeji ${fileName} limefutwa, liko salama wingu la Atlas.`);
            }

            console.log("\n🎯 [Kazi Imekamilika]: Ma-PDF yote yamesafishwa na kusawazishwa (Synced) huko MongoDB Atlas kama Vectors!");
            return true;

        } catch (error) {
            console.error("❌ [Automation Pipeline Critical Error]:", error.message);
            return false;
        } finally {
            await client.close();
        }
    }
}

module.exports = new KnowledgeAutomationService();