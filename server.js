require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const app = express();
app.use(express.json({ limit: '50mb' })); 
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Using the 2026 stable preview model ID that gave the 400 error (proving it exists)
const model = genAI.getGenerativeModel({ 
    model: "gemini-3-flash-preview",
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
    ]
});

app.get('/test', (req, res) => res.json({ status: "Ready" }));

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const mimeType = req.file.mimetype;
    let parts = [];

    // --- CRITICAL FIX: Packaging everything as objects ---
    if (mimeType === 'application/pdf') {
        const data = await pdf(req.file.buffer);
        parts.push({ text: `Extract out-of-range biomarkers for Guru Sankaran. Format as a table. \n\n ${data.text.substring(0, 25000)}` });
    } else if (mimeType.startsWith('image/')) {
        // Fix: Use an object { text: "..." } instead of a raw string
        parts.push({ text: "Analyze this blood test table for Guru Sankaran. Identify all values that are outside the normal range (highlighted in red or according to the 'NI' reference). List the Parameter, the Value, and the Reference Range in a Markdown table." });
        parts.push({
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: mimeType
            }
        });
    } else {
        return res.status(400).json({ error: "Please upload a PDF or Image (PNG/JPG)." });
    }

    // Call the model with the correctly formatted parts
    const result = await model.generateContent({ contents: [{ role: "user", parts }] });
    const response = await result.response;
    res.json({ analysis: response.text() });

  } catch (error) {
    console.error("ANALYSIS ERROR:", error.message);
    res.status(500).json({ error: "AI failed to analyze the file.", details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server active on port ${PORT}`));
