const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

// Initialize Gemini AI
// Ensure GEMINI_API_KEY is set in your Railway Environment Variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// CORS Configuration
// Replace the origin URL with your actual Vercel deployment URL
app.use(cors({
  origin: ['https://your-medinsight-frontend.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Basic health check route
app.get('/', (req, res) => {
  res.send('MedInsight AI Backend is running.');
});

// Analysis route
app.post('/analyze', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided for analysis.' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Analyze the following medical text and provide a concise summary, key findings, and recommended next steps: ${text}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysis = response.text();

    res.json({ analysis });
  } catch (error) {
    console.error('Error during analysis:', error);
    res.status(500).json({ error: 'Failed to analyze the medical text. Check API key and logs.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
