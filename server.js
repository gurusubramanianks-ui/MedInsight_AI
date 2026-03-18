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

    // Prompt logic for MedInsight 2026 Format
   // ... (keep existing imports and setup)

const insightPrompt = `
  You are a clinical analyst for MedInsight. 
  1. Identify the patient's name from the report. If no name is found, refer to them as "the Patient".
  2. Analyze the biomarkers provided.
  
  Follow this EXACT structure with double line breaks between points for spacing:

  # 📊 1. What you need to look into
  - List ONLY biomarkers that are HIGH, LOW, or ABNORMAL. 
  - [Biomarker Name] ([Value]): [1-sentence explanation].

  # ✅ 2. Whats looking Good
  - Group biomarkers within the normal range.

  # 📋 3. Action Items
  - Action 1...
  - Action 2...

  # 🥗 4. Diet Summary
  - **Foods to take:** ...
  - **Foods to avoid:** ...

  # 📈 5. How you're doing
  - Overall status summary.

  # 💡 6. Motivational Quote
  - One sentence.

  # 🔗 7. References
  - List 3 approved organizations.

  STRICT RULE: Do not invent data. If no name is present, do not use 'Guru Sankaran'.
`;

// ... (keep the rest of the file logic same as previous multimodal version)
    if (mimeType === 'application/pdf') {
        const data = await pdf(req.file.buffer);
        parts.push({ text: `${insightPrompt}\n\nREPORT TEXT:\n${data.text.substring(0, 25000)}` });
    } else if (mimeType.startsWith('image/')) {
        parts.push({ text: insightPrompt });
        parts.push({ inlineData: { data: req.file.buffer.toString("base64"), mimeType } });
    }

    const result = await model.generateContent({ contents: [{ role: "user", parts }] });
    const response = await result.response;
    res.json({ analysis: response.text() });

  } catch (error) {
    console.error("ANALYSIS ERROR:", error.message);
    res.status(500).json({ error: "Analysis failed", details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 MedInsight Server Active on ${PORT}`));
