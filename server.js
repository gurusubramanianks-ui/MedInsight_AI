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
    const insightPrompt = `
      You are a clinical analyst for MedInsight. Analyze this report for Guru Sankaran.
      Follow this EXACT structure:

      ## 📊 1. What you need to look into
      - List ONLY biomarkers that are HIGH, LOW, or ABNORMAL. 
      - Include the value and a simple, 1-sentence explanation of what it means for the body.

      ## ✅ 2. Whats looking Good
      - Group the biomarkers that are within the normal reference range.

      ## 📋 3. Action Items
      - List 3-5 clear, actionable steps the patient should discuss with their doctor.

      ## 🥗 4. Diet Summary
      - **Foods to take:** List specific foods that help stabilize the abnormal biomarkers found.
      - **Foods to avoid:** List foods that could worsen the specific conditions identified (e.g., high glucose or triglycerides). Cross-check these for multiple conditions.

      ## 📈 5. How you're doing
      - Provide a brief summary of current health status compared to typical standards.

      ## 💡 6. Motivational Quote
      - Provide a personalized statistical and motivational quote related to health progress.

      ## 🔗 7. References
      - Cite references from approved organizations like ICMR, WHO, or CDC for the abnormal biomarkers found.

      IMPORTANT: Use Markdown formatting. Include a standard medical disclaimer at the very end.
    `;

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
