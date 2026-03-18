require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json({ limit: '50mb' })); 
app.use(cors());

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 } 
});

// 1. UPDATED MODEL: Using the 2026 stable Gemini 3 Flash
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3-flash" });

// Root route for Railway Health Checks (Prevents SIGTERM)
app.get('/', (req, res) => res.status(200).send("MedInsight Backend Active"));
app.get('/test', (req, res) => res.json({ status: "Ready" }));

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Step 1: Extract text to save memory
    const data = await pdf(req.file.buffer);
    const textData = data.text.substring(0, 30000); 

    // Step 2: Surgical Prompt to skip summaries and marketing 
    const prompt = `
      IGNORE the initial summary pages and marketing text.
      SEARCH the detailed pages for the ACTUAL observed values.
      LIST only the out-of-range values in a table.
      REPORT TEXT:
      ${textData}
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ analysis: response.text() });

  } catch (error) {
    console.error("DEBUG:", error.message);
    res.status(500).json({ error: "Analysis failed", details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server live on ${PORT}`));
