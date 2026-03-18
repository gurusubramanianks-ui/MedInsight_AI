require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Memory-efficient storage
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

app.get('/', (req, res) => res.status(200).send("MedInsight Online"));
app.get('/test', (req, res) => res.json({ status: "Ready" }));

app.post('/analyze', upload.any(), async (req, res) => {
  console.log("--- New Request Received ---");
  try {
    if (!req.files || req.files.length === 0) {
        console.log("Error: No files in request");
        return res.status(400).json({ error: "No files detected." });
    }

    console.log(`Processing ${req.files.length} file(s)...`);

    const results = await Promise.all(req.files.map(async (file, index) => {
      console.log(`File [${index}]: ${file.originalname} (${file.mimetype})`);
      
      let contentInput = "";
      if (file.mimetype === 'application/pdf') {
          const data = await pdf(file.buffer);
          contentInput = data.text.substring(0, 45000);
          console.log(`PDF text extracted: ${contentInput.length} chars`);
      }

      const prompt = `
        You are a MedInsight Clinical Parser. Extract patient data.
        1. SCAN for "Tests outside reference range" or "Abnormal Results".
        2. IGNORE "Status: Ready" pages.
        3. EXTRACT Patient Name (use "Unspecified Patient" if missing).
        
        FORMAT: 7-section colored format (Look into, Looking Good, Actions, Diet, Status, Quote, References).
        Use double line breaks between list items.

        RETURN ONLY VALID JSON: {"name": "Name", "content": "Markdown Analysis"}
      `;

      let parts = [{ text: prompt }];
      if (file.mimetype.startsWith('image/')) {
          parts.push({
              inlineData: { data: file.buffer.toString("base64"), mimeType: file.mimetype }
          });
      } else {
          parts.push({ text: `DATA:\n${contentInput}` });
      }

      console.log(`Sending to Gemini [${index}]...`);
      const aiResponse = await model.generateContent({ contents: [{ role: "user", parts }] });
      const rawText = aiResponse.response.text();
      console.log(`Gemini raw output received for [${index}]`);

      // Failsafe JSON Cleaning
      const cleanedJson = rawText.replace(/```json|```/g, "").trim();
      try {
          return JSON.parse(cleanedJson);
      } catch (e) {
          console.log("JSON Parse failed, returning raw as content.");
          return { name: "Analysis Result", content: rawText };
      }
    }));

    console.log("All files processed successfully.");
    res.json({ results });

  } catch (error) {
    console.error("CRITICAL SERVER ERROR:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server listening on ${PORT}`));
