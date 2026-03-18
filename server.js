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

// 1. UPDATED MODEL: Using the specific 2026 ID
const model = genAI.getGenerativeModel({ 
    model: "gemini-3-flash-preview", 
    // 2. SAFETY FIX: Prevents blank results by letting medical data pass
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
    ]
});

app.get('/', (req, res) => res.send("MedInsight Active"));
app.get('/test', (req, res) => res.json({ status: "Ready" }));

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Step 1: Memory-Safe Text Extraction
    const data = await pdf(req.file.buffer);
    const textData = data.text.substring(0, 25000); // Surgical cutoff to avoid 'SIGTERM'

    // Step 2: The Data Extraction Prompt
    const prompt = `Extract only the out-of-range biomarkers for Guru Sankaran. 
    Return a Markdown table with columns: Parameter, Observed Value, Reference Range. 
    TEXT: ${textData}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ analysis: response.text() });

  } catch (error) {
    console.error("DEBUG:", error.message);
    res.status(500).json({ error: "AI Processing Error", details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server active on ${PORT}`));
