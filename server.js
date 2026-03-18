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
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB safety limit
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// The Fix: Use 'gemini-1.5-flash' without the v1beta prefix in the string
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Health Check for Railway (Prevents SIGTERM) 
app.get('/', (req, res) => res.status(200).send("MedInsight Active"));
app.get('/test', (req, res) => res.json({ status: "Ready" }));

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });

    // Step 1: Extract text (Saves memory over sending full PDF to AI) [cite: 17, 26]
    const data = await pdf(req.file.buffer);
    
    // Step 2: Chunk the text to stay within memory limits 
    const textSnippet = data.text.substring(0, 25000); 

    // Step 3: Surgical Prompt for Guru Sankaran's report [cite: 13, 26]
    const prompt = `Identify ONLY abnormal biomarkers (High/Low) in this medical text. 
    Return as a Markdown table.
    TEXT: ${textSnippet}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 600, temperature: 0.1 }
    });

    const response = await result.response;
    res.json({ analysis: response.text() });

  } catch (error) {
    console.error("AI ERROR:", error.message);
    res.status(500).json({ error: "Analysis failed", details: error.message });
  }
});

// Bind to 0.0.0.0 and dynamic port [cite: 1, 23, 26]
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
