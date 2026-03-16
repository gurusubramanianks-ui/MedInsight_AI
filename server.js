const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const app = express();
app.use(express.json());

// Initialize Gemini (Replace with your API Key from Google AI Studio)
const genAI = new GoogleGenerativeAI("YOUR_GEMINI_API_KEY");

app.post('/analyze', async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = "Extract medical markers from this text and provide a summary: " + req.body.text;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ summary: response.text() });
  } catch (error) {
    res.status(500).send("AI Analysis failed.");
  }
});

app.listen(3000, () => console.log('MedInsight Engine running on port 3000'));
