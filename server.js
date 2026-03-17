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
    limits: { fileSize: 25 * 1024 * 1024 } 
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// The "async" keyword here is what was missing in your error log
app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let textToAnalyze = "";
    const mimeType = req.file.mimetype;

    // 1. Extract Text based on file type
    if (mimeType === 'application/pdf') {
        const data = await pdf(req.file.buffer);
        textToAnalyze = data.text;
    } else if (mimeType.includes('officedocument')) {
        const docResult = await mammoth.extractRawText({ buffer: req.file.buffer });
        textToAnalyze = docResult.value;
    } else if (mimeType.startsWith('image/')) {
        // Surgical Image handling
        const result = await model.generateContent([
            "Extract only abnormal medical values from this image.",
            { inlineData: { data: req.file.buffer.toString("base64"), mimeType } }
        ]);
        return res.json({ analysis: (await result.response).text() });
    }

    // 2. Surgical Prompt for large reports 
    const prompt = `
      CONTEXT: 19-page medical lab report.
      TASK: Extract ONLY abnormal/out-of-range values. 
      FORMAT: Simple Markdown table: Parameter, Observed Value, Reference Range.
      LIMIT: Skip marketing and summaries. If everything is normal, say "All normal."
      DATA: ${textToAnalyze.substring(0, 35000)}
    `;

    // 3. AI Generation with performance config 
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.1, 
      }
    });

    const response = await result.response;
    res.json({ analysis: response.text() });

  } catch (error) {
    console.error("ANALYSIS FAILED:", error.message);
    res.status(500).json({ error: "Processing failed.", details: error.message });
  }
});

app.get('/test', (req, res) => res.json({ status: "Ready" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on port ${PORT}`));
