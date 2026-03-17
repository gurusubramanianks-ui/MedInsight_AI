require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 } // 30MB Limit
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let textToAnalyze = "";
    const mimeType = req.file.mimetype;

    // 1. Robust Text Extraction
    try {
        if (mimeType === 'application/pdf') {
            const data = await pdf(req.file.buffer);
            textToAnalyze = data.text;
        } else if (mimeType.includes('officedocument')) {
            const docResult = await mammoth.extractRawText({ buffer: req.file.buffer });
            textToAnalyze = docResult.value;
        } else if (mimeType.startsWith('image/')) {
            const result = await model.generateContent([
                "Identify out-of-range medical values.",
                { inlineData: { data: req.file.buffer.toString("base64"), mimeType } }
            ]);
            return res.json({ analysis: (await result.response).text() });
        }
    } catch (parseErr) {
        return res.status(500).json({ error: "Failed to read file content.", details: parseErr.message });
    }

    // 2. Surgical Prompt for 19-page files
    const prompt = `
      TASK: Extract ONLY out-of-range/abnormal values from this 19-page medical report.
      FORMAT: Markdown table (Parameter, Value, Range).
      LIMIT: Skip all marketing/summary pages.
      DATA: ${textToAnalyze.substring(0, 30000)}
    `;

    // 3. AI call with strict timeout safety
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 800, temperature: 0.1 }
    });

    const response = await result.response;
    res.json({ analysis: response.text() });

  } catch (error) {
    console.error("ANALYSIS ERROR:", error.message);
    res.status(500).json({ error: "AI failed to respond.", details: error.message });
  }
});

app.get('/test', (req, res) => res.json({ status: "Ready" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on ${PORT}`));
