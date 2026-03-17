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

// 1. Initialize Gemini
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// 2. Main Processing Route
app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let textData = "";
    if (req.file.mimetype === 'application/pdf') {
        const data = await pdf(req.file.buffer);
        textData = data.text;
    } else {
        const docResult = await mammoth.extractRawText({ buffer: req.file.buffer });
        textData = docResult.value;
    }

    // 3. Surgical analysis for Guru Sankaran's 19-page report
    const prompt = `Identify abnormal values in this report text. Format as a table. \n\n ${textData.substring(0, 25000)}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ analysis: response.text() });

  } catch (error) {
    console.error("DEBUG:", error.message);
    res.status(500).json({ 
        error: "AI failed to respond.", 
        details: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on ${PORT}`));
