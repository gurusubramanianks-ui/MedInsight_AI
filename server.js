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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const mimeType = req.file.mimetype;
    let prompt = "You are a medical lab assistant. Analyze this medical report. List biomarkers, explain them simply, highlight out-of-range values, and include a disclaimer that this is not a diagnosis.";
    let parts = [];

    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      // Handle Images and PDFs directly
      parts = [
        prompt,
        {
          inlineData: {
            data: req.file.buffer.toString("base64"),
            mimeType: mimeType,
          },
        },
      ];
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Handle Word Files (.docx) by extracting text
      const docResult = await mammoth.extractRawText({ buffer: req.file.buffer });
      parts = [`${prompt}\n\nHere is the text from the medical report:\n${docResult.value}`];
    } else {
      return res.status(400).json({ error: "Unsupported file type. Use PDF, Image, or DOCX." });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    res.json({ analysis: response.text() });

  } catch (error) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: "Analysis failed. Please try a clearer file." });
  }
});

app.get('/test', (req, res) => res.json({ status: "Ready" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
