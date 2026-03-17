require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const upload = multer({ storage: multer.memoryStorage() }); // Store file in RAM temporarily

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// API Route for Analyzing Lab Results
app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Convert buffer to Google Generative AI format
    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    const prompt = "You are a medical lab assistant. Analyze this blood test/medical report. List the key biomarkers, explain what they mean in simple terms, and highlight anything outside normal ranges. Disclaimer: State that this is not a diagnosis.";

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    
    res.json({ analysis: response.text() });
  } catch (error) {
    console.error("AI Analysis Error:", error);
    res.status(500).json({ error: "Failed to analyze report" });
  }
});

app.get('/test', (req, res) => res.json({ status: "Ready" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server on ${PORT}`));
