require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// Increase JSON limits for large PDF data strings
app.use(express.json({ limit: '50mb' })); 
app.use(cors());

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 } // 30MB limit
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });

    // Step 1: Extract Text (Crucial for 19-page files)
    const data = await pdf(req.file.buffer);
    const text = data.text.substring(0, 30000); // Surgical cutoff

    // Step 2: Optimized Prompt
    const prompt = `Find only out-of-range values in this medical text. List Parameter, Value, and Range in a table. \n\n ${text}`;

    // Step 3: AI Call with fast generation settings
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 800, temperature: 0.1 }
    });

    res.json({ analysis: (await result.response).text() });
  } catch (error) {
    console.error("DEBUG:", error.message);
    res.status(500).json({ error: "AI Processing Error", details: error.message });
  }
});

// Health check for Railway to see the app is alive
app.get('/test', (req, res) => res.json({ status: "Ready" }));

// CRITICAL: Bind to 0.0.0.0 and use Railway's dynamic PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server live on port ${PORT}`);
});
