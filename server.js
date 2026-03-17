require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// Set limits to handle the 19-page file size
app.use(express.json({ limit: '50mb' }));
app.use(cors());

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Safety check for API Key
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY is not set in Railway Variables!");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let textToAnalyze = "";
    const mimeType = req.file.mimetype;

    // STEP 1: Extract Text 
    try {
        if (mimeType === 'application/pdf') {
            const data = await pdf(req.file.buffer);
            textToAnalyze = data.text;
        } else if (mimeType.includes('officedocument')) {
            const docResult = await mammoth.extractRawText({ buffer: req.file.buffer });
            textToAnalyze = docResult.value;
        } else if (mimeType.startsWith('image/')) {
            // For images, we send the buffer directly to Gemini 
            const result = await model.generateContent([
                "Analyze this medical image for out-of-range values.",
                { inlineData: { data: req.file.buffer.toString("base64"), mimeType } }
            ]);
            return res.json({ analysis: (await result.response).text() });
        }
    } catch (parseErr) {
        console.error("Extraction Error:", parseErr);
        return res.status(500).json({ error: "Could not read the file content." });
    }

    // STEP 2: Send Text to Gemini with "Ignore Summary" instruction 
    const prompt = `
      You are a medical lab expert. Analyze the following text from a 19-page report.
      1. IGNORE the initial summary pages and marketing text.
      2. SEARCH the detailed data for observed values outside reference ranges.
      3. Focus on Hematology, Lipid, Liver, and Diabetes.
      4. List out-of-range values in a table.
      5. Include a disclaimer.
      
      REPORT TEXT:
      ${textToAnalyze.substring(0, 35000)}
    `;

    const result = await model.generateContent(prompt);
    res.json({ analysis: (await result.response).text() });

  } catch (error) {
    console.error("GEMINI ERROR:", error.message);
    res.status(500).json({ error: "AI Processing failed.", details: error.message });
  }
});

app.get('/test', (req, res) => res.json({ status: "Ready" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on ${PORT}`));
