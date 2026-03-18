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

// --- STARTUP CHECK ---
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");

// The fix: Explicitly using the standard model name
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.get('/', (req, res) => res.send("MedInsight Active"));
app.get('/test', (req, res) => res.json({ status: "Ready" }));

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });

    // Step 1: Extract text to save memory for 19-page files [cite: 15, 17]
    const data = await pdf(req.file.buffer);
    const text = data.text.substring(0, 25000); // Surgical limit [cite: 15, 17]

    // Step 2: Optimized Prompt for Guru Sankaran's results [cite: 13, 15]
    const prompt = `Identify ONLY abnormal biomarkers in this medical text. Table format. \n\n ${text}`;

    // Step 3: Fast Generation Config [cite: 15, 18]
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.1 }
    });

    res.json({ analysis: (await result.response).text() });
  } catch (error) {
    console.error("AI ERROR:", error.message);
    res.status(500).json({ error: "AI Call Failed", details: error.message });
  }
});

const PORT = process.env.PORT || 8080; // Bound to Railway's port [cite: 1, 23]
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on ${PORT}`));
