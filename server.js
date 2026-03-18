require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const app = express();

// Set limits high for the request, but we will handle memory surgically
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Memory-efficient Multer storage
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } 
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ 
    model: "gemini-3-flash-preview",
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
    ]
});

// Health check for Railway to prevent SIGTERM during boot
app.get('/', (req, res) => res.status(200).send("MedInsight Intelligent Engine is Online"));
app.get('/test', (req, res) => res.json({ status: "Ready" }));

// Using .any() to prevent "Unexpected Field" errors entirely
app.post('/analyze', upload.any(), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files detected in the request." });
    }

    const results = await Promise.all(req.files.map(async (file) => {
      let contentInput = "";

      if (file.mimetype === 'application/pdf') {
          // Intelligent Text Extraction
          const data = await pdf(file.buffer);
          // 45,000 chars is the "Sweet Spot" for 20-page Thyrocare reports to stay under memory limits
          contentInput = data.text.substring(0, 45000); 
      }

      const prompt = `
        You are a MedInsight Clinical Parser. I am providing you with a lab report (PDF text or Image).
        
        CRITICAL INSTRUCTIONS:
        1. SCAN the entire document for the heading "Tests outside reference range" or "Abnormal Results". 
        2. DO NOT ignore the end of the report; Thyrocare often places summaries on later pages.
        3. IGNORE pages that only show "Status: Ready" or laboratory branding/disclaimers.
        4. EXTRACT the Patient Name. If no name is found, use "Unspecified Patient".
        
        REPORT FORMAT:
        Follow the 7-section colored format (Look into, Looking Good, Actions, Diet, Status, Quote, References).
        Add double line breaks between every list item for UI spacing.

        RETURN ONLY VALID JSON: {"name": "Name Here", "content": "Markdown String Here"}
      `;

      let parts = [{ text: prompt }];
      
      if (file.mimetype.startsWith('image/')) {
          parts.push({
              inlineData: { data: file.buffer.toString("base64"), mimeType: file.mimetype }
          });
      } else {
          parts.push({ text: `DATA SOURCE:\n${contentInput}` });
      }

      const aiResponse = await model.generateContent({ contents: [{ role: "user", parts }] });
      const responseText = aiResponse.response.text().replace(/```json|```/g, "").trim();
      
      return JSON.parse(responseText);
    }));

    res.json({ results });

  } catch (error) {
    console.error("ENGINE ERROR:", error.message);
    res.status(500).json({ error: "Processing failed", details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MedInsight Active on Port ${PORT}`);
});
