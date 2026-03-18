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

// --- STARTUP KEY CHECK ---
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ ERROR: GEMINI_API_KEY is missing from Railway Variables!");
} else if (API_KEY.startsWith("AIza") === false) {
    console.error("❌ ERROR: Your API Key looks invalid (should start with AIza).");
} else {
    console.log("✅ SUCCESS: API Key detected and formatted correctly.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.get('/', (req, res) => res.send("MedInsight Backend Active"));
app.get('/test', (req, res) => res.json({ status: "Ready" }));

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const data = await pdf(req.file.buffer);
    const text = data.text.substring(0, 30000); 

    const result = await model.generateContent(`Extract abnormal values: \n\n ${text}`);
    res.json({ analysis: (await result.response).text() });
  } catch (error) {
    console.error("AI ERROR:", error.message);
    res.status(500).json({ error: "AI Rejected Request", details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on ${PORT}`));
