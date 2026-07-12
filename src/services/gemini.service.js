// src/services/gemini.service.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { MongoDBAtlasVectorSearch } = require("@langchain/mongodb");
const { MongoClient } = require("mongodb");

class GeminiService {
    constructor() {
        // Core SDK ya mwanzo (kwa ajili ya Alerts na Fallbacks za kienyeji)
        this.ai = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
        
        // MTAMBO MPYA: LangChain Chat Model
        this.langchainModel = process.env.GEMINI_API_KEY 
            ? new ChatGoogleGenerativeAI({
                apiKey: process.env.GEMINI_API_KEY,
                model: "gemini-2.5-flash-lite", // Kasi kubwa inayolinda USSD isilete timeout
                temperature: 0.15 // Inapunguza AI kuropoka (hallucination)
              })
            : null;
                
        // Muunganisho wa MongoDB Atlas kwa ajili ya Vector Search
        this.mongoClient = new MongoClient(process.env.MONGODB_ATLAS_URI || "mongodb://localhost:27017");
    }

    /**
     * NYALE YA USSD FALLBACK - SASA INATUMIA LANGCHAIN + MONGODB ATLAS VECTOR SEARCH
     * Hapa tunapokea na mysqlContext (data za mkulima na hali ya hewa tulizovuta MySQL)
     */
    async askUssdFallback(cropName, symptomKeyword, mysqlContext = {}) {
        try {
            // Kama funguo haziko sawa, kimbilia jibu la dharura la haraka
            if (!this.langchainModel || !process.env.MONGODB_ATLAS_URI) {
                return this.getFallbackResponse(cropName);
            }

            console.log(`\n🔍 [AI Agent]: Expert Rule imekosekana. Inatafuta mwongozo wa PDF huko MongoDB Atlas kwa ajili ya ${cropName}...`);
            
            // 1. ANZA NA VECTOR SEARCH YA ATLAS (Kuchota Kipande cha PDF cha zao husika)
            await this.mongoClient.connect();
            const db = this.mongoClient.db("agricultural_advisory_system"); // Imeendana na jina la DB ya Automation
            const collection = db.collection("pdf_knowledge_vectors");

            // REKEBISHO LA HOJA YA 404 ERROR:
            const embeddings = new GoogleGenerativeAIEmbeddings({
                apiKey: process.env.GEMINI_API_KEY,
                model: "models/text-embedding-005", // ✅ Tumia 'model' na weka njia kamili yenye 'models/'
            });

            const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
                collection,
                indexName: "vector_index", // Jina la index tulilotengeneza Atlas dashboard
                textKey: "content",
                embeddingKey: "embedding",
            });

            // Smart Routing Filter: Tafuta kipande 1 tu sahihi na chuja kwa zao husika
            const filter = {
                preFilter: {
                    "crop_name": {
                        "$eq": cropName.toLowerCase()
                    }
                }
            };

            const relevantDocs = await vectorStore.similaritySearch(symptomKeyword, 1, filter);

            const pdfContext = relevantDocs.length > 0 
                ? relevantDocs[0].pageContent 
                : "Magonjwa ya jumla na tiba mbadala ya mazao.";

            console.log(`📚 [AI Agent]: Kipande cha PDF kimepatikana kutoka faili: ${relevantDocs[0]?.metadata?.source || 'Unknown'}`);

            // 2. ANDAA UTIRIRISHAJI WA NDANI (System Instruction + Context Generation)
            const systemInstruction = `Wewe ni mtaalamu wa kilimo na daktari wa mimea nchini Tanzania.
Kazi yako ni kusoma muktadha wa PDF uliorudishwa, data ya shamba na hali ya hewa ya mkulima, kisha utoe jibu la kisayansi na fupi.

MUKTADHA WA PDF (Miongozo ya Serikali):
"${pdfContext}"

DATA YA MKULIMA & HALI YA HEWA (Kutoka MySQL):
- Eneo: Wilaya ya ${mysqlContext.district || 'Songea'}, Kata ya ${mysqlContext.ward || 'Bombambili'}
- Historia ya Shamba: Zao la ${cropName}, Ukubwa Ekari ${mysqlContext.farm_size || '1'}
- Hali ya Hewa ya Sasa: ${mysqlContext.live_weather || 'Kavu/Jua la kawaida'}

SHERIA KALI ZA MUUNDO (JSON ONLY):
1. diagnosis: Jina halisi la kiufundi la ugonjwa/tatizo kulingana na PDF na dalili (Max herufi 25).
2. sms_content: Ushauri wa tiba ulioshikana kwenda kwa mkulima unaoendana na hali ya hewa (Max herufi 120). Usiweke vipimo kama (10ml/20L).

KUMBUKA: Jibu lento lazima liwe VALID JSON pekee. Usiweke alama za \`\`\`json au maelezo mengine yoyote nje ya mabano ya JSON.`;

            const prompt = `Zao: ${cropName}. Dalili ya mkulima: "${symptomKeyword}".`;

            // 3. PIGA GEMINI KUPITIA LANGCHAIN KWA MKUPUO MMOJA (Single-Turn Agent)
            const finalPrompt = `${systemInstruction}\n\nSwali: ${prompt}`;
            const response = await this.langchainModel.invoke(finalPrompt);
            
            const responseText = response.content.trim();
            // Kagua na safisha kama kuna mabaki ya viashiria vya JSON vimejipenyeza
            const cleanJsonText = responseText.replace(/```json|```/g, "").trim();
            const cleanData = JSON.parse(cleanJsonText);
            
            return {
                diagnosis: cleanData.diagnosis || `Shida ya ${cropName}`,
                recommendation: cleanData.sms_content || "Kagua shamba lako au wasiliana na afisa ugani."
            };

        } catch (error) {
            console.error("❌ [Gemini + LangChain Vector Fallback Error]:", error.message);
            return this.getFallbackResponse(cropName);
        } finally {
            await this.mongoClient.close();
        }
    }

    /**
     * Kutengeneza SMS za Tahadhari (Proactive Alerts)
     */
    async generateSmsAlert({ systemInstruction, prompt }) {
        if (!this.ai) return null;
        try {
            console.log("[Gemini Service]: Inatengeneza SMS Alert...");
            const model = this.ai.getGenerativeModel({ 
                model: "gemini-2.5-flash-lite",
                systemInstruction: systemInstruction
            });
            
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 }
            });
            
            return result.response.text().trim();
        } catch (error) {
            console.error("[Gemini Service SMS Alert Error]:", error.message);
            return null;
        }
    }

    async askFallback(cropName, symptom) {
        return this.askUssdFallback(cropName, symptom);
    }

    getFallbackResponse(cropName) {
        return {
            diagnosis: `Tatizo la ${cropName}`,
            recommendation: "Kagua shamba lako vizuri au fika kituo cha pembejeo kilicho karibu nawe kupata msaada."
        };
    }
}

module.exports = new GeminiService();