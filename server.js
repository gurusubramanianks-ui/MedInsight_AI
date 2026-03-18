require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const app = express();
app.use(express.json({ limit: '50mb' })); 
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 1. UPDATED MODEL: Using the 3.1 branch for 2026
const model = genAI.getGenerativeModel({ 
    model: "gemini-3.1-flash-preview",
    // 2. SAFETY FIX: Prevents the "blank" response by allowing medical data
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ]
});

app.get('/', (req, res) => res.send("MedInsight Active"));
app.get('/test', (req, res) => res.json({ status: "Ready" }));

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });

    const data = await pdf(req.file.buffer);
    const textSnippet = data.text.substring(0, 25000); 

    // 3. IMPROVED PROMPT: Explicitly asking for a data table to avoid "Advice" triggers
    const prompt = `You are a data extraction tool. Extract only the biomarkers, observed values, and reference ranges from this text for Guru Sankaran. 
    Format as a Markdown table. Do not provide a diagnosis. 
    TEXT: ${textSnippet}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) throw new Error("AI returned an empty response. Check safety filters.");

    res.json({ analysis: text });
  } catch (error) {
    console.error("AI ERROR:", error.message);
    res.status(500).json({ error: "Analysis failed", details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server active on ${PORT}`));
