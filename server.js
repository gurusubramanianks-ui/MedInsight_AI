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

    // --- THE "FORK IN THE ROAD" FIX ---
    if (mimeType === 'application/pdf') {
        // Handle PDF text extraction
        const data = await pdf(req.file.buffer);
        parts.push(`Extract out-of-range biomarkers for Guru Sankaran. Table format. \n\n ${data.text.substring(0, 25000)}`);
    } else if (mimeType.startsWith('image/')) {
        // Handle PNG/JPG vision
        parts.push("Analyze this medical report image for Guru Sankaran. List only out-of-range biomarkers in a Markdown table.");
        parts.push({
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: mimeType
            }
        });
    } else {
        return res.status(400).json({ error: "Unsupported file type. Use PDF or PNG/JPG." });
    }

    const result = await model.generateContent({ contents: [{ role: "user", parts }] });
    const response = await result.response;
    res.json({ analysis: response.text() });

  } catch (error) {
    console.error("ANALYSIS ERROR:", error.message);
    res.status(500).json({ error: "Processing failed", details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server active on ${PORT}`));
