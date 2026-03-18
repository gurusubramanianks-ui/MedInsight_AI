require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// Increase limits for your 19-page report [cite: 15, 17]
app.use(express.json({ limit: '50mb' })); 
app.use(cors());

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 } 
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- THE CRITICAL FIX FOR SIGTERM ---
// Railway pings this route to see if the app is alive.
app.get('/', (req, res) => {
  console.log("Health check received at root /");
  res.status(200).send("MedInsight Backend is Active");
});

app.get('/test', (req, res) => {
  res.json({ status: "Ready" });
});

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });

    // Extract text to avoid memory crashes on 19 pages [cite: 15, 17]
    const data = await pdf(req.file.buffer);
    const text = data.text.substring(0, 30000); 

    const prompt = `Find abnormal values in this medical text for Guru Sankaran. List Parameter, Value, and Range in a table. \n\n ${text}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 800, temperature: 0.1 }
    });

    res.json({ analysis: (await result.response).text() });
  } catch (error) {
    console.error("ANALYSIS ERROR:", error.message);
    res.status(500).json({ error: "AI Processing Error", details: error.message });
  }
});

// Use Railway's dynamic PORT and bind to 0.0.0.0 [cite: 1, 15, 23]
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server live on port ${PORT}`);
});
