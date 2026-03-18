require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const app = express();
app.use(express.json({ limit: '50mb' })); 
app.use(cors());

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB for high-res lab PDFs
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ 
    model: "gemini-3-flash-preview",
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
    ]
});

// STASHED FEATURE: Compare Results (For future implementation)
const compareResultsModule = (results) => {
    // Logic to be implemented later for side-by-side mapping
    return null;
};

app.get('/test', (req, res) => res.json({ status: "Ready" }));

app.post('/analyze', upload.array('reports', 2), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No files uploaded" });

    const results = await Promise.all(req.files.map(async (file) => {
      let contentInput = "";

      if (file.mimetype === 'application/pdf') {
          // Extract full text to allow the AI to find headings on any page
          const data = await pdf(file.buffer);
          contentInput = data.text.substring(0, 50000); // 50k chars covers ~25 pages of text
      }

      const prompt = `
        You are a MedInsight Clinical Parser. I am providing you with a lab report (PDF text or Image).
        
        INSTRUCTIONS:
        1. SCAN for headings like "Tests outside reference range", "Abnormal Results", or "Flagged Values".
        2. IGNORE pages that only show "Status: Ready", Terms & Conditions, or generic lab marketing.
        3. EXTRACT the Patient Name. If no name is found, use "Unspecified Patient".
        4. ANALYZE the data and provide the report in the following 7-section Markdown format.
        
        FORMAT REQUIREMENTS:
        - Use ## for headers.
        - Add TWO line breaks between every bullet point for readability.
        - Section 1: 📊 1. What you need to look into (Abnormal values + 1-sentence meaning)
        - Section 2: ✅ 2. Whats looking Good (Normal values)
        - Section 3: 📋 3. Action Items (Actionable steps)
        - Section 4: 🥗 4. Diet Summary (Foods to take/avoid cross-checked for conditions)
        - Section 5: 📈 5. How you're doing (Overall summary)
        - Section 6: 💡 6. Motivational Quote
        - Section 7: 🔗 7. References (ICMR, WHO, or CDC)

        OUTPUT: Return ONLY a valid JSON object: {"name": "Patient Name", "content": "Markdown string"}
      `;

      let parts = [{ text: prompt }];
      if (file.mimetype.startsWith('image/')) {
          parts.push({
              inlineData: { data: file.buffer.toString("base64"), mimeType: file.mimetype }
          });
      } else {
          parts.push({ text: `REPORT DATA:\n${contentInput}` });
      }

      const aiResponse = await model.generateContent({ contents: [{ role: "user", parts }] });
      const rawText = aiResponse.response.text().replace(/```json|```/g, "").trim();
      return JSON.parse(rawText);
    }));

    res.json({ results });

  } catch (error) {
    console.error("ANALYSIS ERROR:", error.message);
    res.status(500).json({ error: "Analysis failed", details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 MedInsight Intelligent Engine Active on ${PORT}`));
