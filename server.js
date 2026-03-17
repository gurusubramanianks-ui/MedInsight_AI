require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

// Check key at startup
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY || API_KEY.length < 10) {
    console.error("FATAL: API Key is missing or too short!");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let textToAnalyze = "";
    if (req.file.mimetype === 'application/pdf') {
        const data = await pdf(req.file.buffer);
        textToAnalyze = data.text;
    } else {
        const docResult = await mammoth.extractRawText({ buffer: req.file.buffer });
        textToAnalyze = docResult.value;
    }

    const prompt = `Analyze this lab report text. List only out-of-range values in a table. \n\n ${textToAnalyze.substring(0, 20000)}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ analysis: response.text() });

  } catch (error) {
    // This logs the SPECIFIC reason Google rejected the call
    console.error("GOOGLE API ERROR:", error.message);
    res.status(500).json({ 
        error: "AI failed to respond.", 
        details: error.message // This sends the exact reason to your browser
    });
  }
});

app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log("Server Live"));
