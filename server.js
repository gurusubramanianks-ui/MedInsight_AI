require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Analysis Route
app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const mimeType = req.file.mimetype;
    const prompt = "You are a medical lab assistant. Analyze this report. List biomarkers, explain them simply, highlight out-of-range values, and include a medical disclaimer.";
    let parts = [];

    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      parts = [prompt, { inlineData: { data: req.file.buffer.toString("base64"), mimeType } }];
    } else if (mimeType.includes('officedocument')) {
      const docResult = await mammoth.extractRawText({ buffer: req.file.buffer });
      parts = [`${prompt}\n\nReport Text:\n${docResult.value}`];
    } else {
      return res.status(400).json({ error: "Unsupported file type." });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    res.json({ analysis: response.text() });

  } catch (error) {
    console.error("DETAILED SERVER ERROR:", error.message);
    res.status(500).json({ 
      error: "Analysis failed. The report might be too large or the AI timed out.", 
      details: error.message 
    });
  }
});

// Health Check
app.get('/test', (req, res) => res.json({ status: "Ready", service: "MedInsight" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server active on port ${PORT}`));
