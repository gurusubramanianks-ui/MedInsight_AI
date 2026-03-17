require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "YOUR_FALLBACK_KEY_IF_LOCAL");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Test Route
app.get('/test', (req, res) => {
  res.json({ 
    status: "Success", 
    message: "MedInsight Backend is live with Gemini AI support!" 
  });
});

// Basic AI Route (Example)
app.post('/ask', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ text: response.text() });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "AI failed to respond" });
  }
});

const PORT = process.env.PORT || 3000;

// Listen on 0.0.0.0 for Railway
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
