require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json({ limit: '50mb' })); 
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

// --- STARTUP LOGGING ---
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");

// FIX: Updated to the correct 2026 Preview identifier
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

app.get('/', (req, res) => res.send("MedInsight Backend Active"));
app.get('/test', (req, res) => res.json({ status: "Ready" }));

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Step 1: Memory-Safe Text Extraction
    let textData = "";
    try {
        const data = await pdf(req.file.buffer);
        // Only take the first 25,000 characters to prevent memory 'SIGTERM'
        textData = data.text.substring(0, 25000); 
    } catch (e) {
        return res.status(500).json({ error: "PDF too complex for server memory. Try a smaller file." });
    }

    // Step 2: The Surgical Prompt
    const prompt = `Identify out-of-range biomarkers for Guru Sankaran. Table format. \n\n ${textData}`;

    // Step 3: AI call with strict token limits
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 600, temperature: 0.1 }
    });

    const response = await result.response;
    res.json({ analysis: response.text() });

  } catch (error) {
    console.error("AI ERROR:", error.message);
    res.status(500).json({ error: "AI Call Failed", details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server active on port ${PORT}`));
