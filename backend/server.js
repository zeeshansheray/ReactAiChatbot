const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const POLICIES_FOLDER = "./policies";
const VECTOR_DB_FILE = "vector_db_policies.json";
let VECTOR_DB = {};

const loadTextFile = (filePath) => {
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        return chunkText(content);
    } catch (error) {
        console.error(`Error loading file ${filePath}:`, error);
        return [];
    }
};

const extractTextFromPdf = async (filePath) => {
    try {
        const data = await pdfParse(fs.readFileSync(filePath));
        return chunkText(data.text);
    } catch (error) {
        console.error(`Error extracting text from PDF ${filePath}:`, error);
        return [];
    }
};

const chunkText = (text, chunkSize = 300) => {
    const words = text.split(" ");
    return words.reduce((chunks, word, index) => {
        const chunkIndex = Math.floor(index / chunkSize);
        chunks[chunkIndex] = (chunks[chunkIndex] || []).concat(word);
        return chunks;
    }, []).map(chunk => chunk.join(" "));
};

const createEmbedding = async (text) => {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: text
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error("Error generating embedding:", error);
        return null;
    }
};

const addParagraphsToDb = async (fileName, paragraphs) => {
    const vectorDb = [];
    for (const paragraph of paragraphs) {
        const embedding = await createEmbedding(paragraph);
        if (embedding) vectorDb.push({ paragraph, embedding });
    }
    if (vectorDb.length) VECTOR_DB[fileName] = vectorDb;
};

const saveVectorDb = () => {
    fs.writeFileSync(VECTOR_DB_FILE, JSON.stringify(VECTOR_DB, null, 4), "utf-8");
};

const loadVectorDb = () => {
    if (fs.existsSync(VECTOR_DB_FILE)) {
        try {
            VECTOR_DB = JSON.parse(fs.readFileSync(VECTOR_DB_FILE, "utf-8"));
        } catch (error) {
            console.error("Error loading vector database:", error);
        }
    }
};

const cosineSimilarity = (a, b) => {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val ** 2, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val ** 2, 0));
    return normA && normB ? dotProduct / (normA * normB) : 0;
};

const retrieve = async (query, topN = 2) => {
    const queryEmbedding = await createEmbedding(query);
    if (!queryEmbedding) return [];

    const similarities = Object.values(VECTOR_DB).flatMap(vectorDb => {
        if (!Array.isArray(vectorDb)) {
            console.error("Invalid data format in VECTOR_DB:", vectorDb);
            return []; // Skip invalid entries
        }
        return vectorDb.map(({ paragraph, embedding }) => ({
            paragraph,
            similarity: cosineSimilarity(queryEmbedding, embedding),
        }));
    });

    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, topN);
};

const generateResponse = async (query, retrievedKnowledge) => {
    const context = retrievedKnowledge.map(({ paragraph }) => ` - ${paragraph}`).join("\n");
    const prompt = `
    You are an AI assistant specializing in company policies. Provide professional and concise answers without referencing specific documents.
    If additional details are required, ask the user what specific aspect they would like elaboration on.
    If the necessary information is unavailable, respond with:
    "I'm sorry, but I don't have the necessary details to answer this."
    Context:
    ${context}
    Question: ${query}
    `;
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "system", content: prompt }],
            max_tokens: 200,
            temperature: 0
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error("Error generating response:", error);
        return "I couldn't generate a response at this moment.";
    }
};

const handlePolicy = async () => {
    const files = fs.readdirSync(POLICIES_FOLDER);
    for (const filename of files) {
        if (!VECTOR_DB[filename]) {
            const filePath = path.join(POLICIES_FOLDER, filename);
            const paragraphs = filename.endsWith(".txt")
                ? loadTextFile(filePath)
                : await extractTextFromPdf(filePath);
            await addParagraphsToDb(filename, paragraphs);
        }
    }
    saveVectorDb();
};

app.post("/api/query", async (req, res) => {
    const { query } = req.body;
    console.log('query ', query)
    if (!fs.existsSync(VECTOR_DB_FILE)) {
        return res.status(400).json({ error: "Vector database not found. Train the model first." });
    }
    loadVectorDb();
    const retrievedKnowledge = await retrieve(query);
    if (!retrievedKnowledge.length) {
        return res.status(400).json({ error: "No relevant information found." });
    }
    const response = await generateResponse(query, retrievedKnowledge);
    res.json({ response });
});

app.post("/api/train", async (req, res) => {
    await handlePolicy();
    res.json({ message: "All policy files have been processed and embedded." });
});

loadVectorDb();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
