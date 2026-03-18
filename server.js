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

// --- THE DIAGNOSTIC CHECK ---
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ STARTUP ERROR: The variable 'GEMINI_API_KEY' is NOT found in the environment.");
} else {
    console.log(`✅ STARTUP SUCCESS: Key found. Length: ${apiKey.length} characters.`);
}

// Use the 2026 Gemini 3 Flash model
const genAI = new GoogleGenerativeAI(apiKey || "");
const model = genAI.getGenerativeModel({ model: "gemini-3-flash" });

app.get('/', (req, res) => res.send("MedInsight Backend Active"));
app.get('/test', (req, res) => res.json({ status: "Ready", keyDetected: !!apiKey }));

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    
    // Extract text from the 19-page report
    const data = await pdf(req.file.buffer);
    const textSnippet = data.text.substring(0, 30000); 

    const prompt = `Identify abnormal biomarkers for Guru Sankaran. Table format. \n\n ${textSnippet}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ analysis: response.text() });
  } catch (error) {
    console.error("AI ERROR:", error.message);
    res.status(500).json({ error: "AI Rejected Request", details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server listening on ${PORT}`));
