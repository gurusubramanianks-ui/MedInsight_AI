require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
// Increase the limit for JSON/Form data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 } // Allow up to 20MB files
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post('/analyze', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let extractedText = "";
    const mimeType = req.file.mimetype;

    // 1. Extract Text based on file type
    if (mimeType === 'application/pdf') {
      const data = await pdf(req.file.buffer);
      extractedText = data.text;
    } else if (mimeType.includes('officedocument')) {
      const docResult = await mammoth.extractRawText({ buffer: req.file.buffer });
      extractedText = docResult.value;
    } else if (mimeType.startsWith('image/')) {
       // Images still need to be sent as Base64
       return await handleImage(req, res);
    }

    // 2. Specialized Prompt to skip summaries and marketing
    const prompt = `
      You are a clinical data analyst. I am providing the text of a 19-page medical report.
      INSTRUCTIONS:
      1. IGNORE the initial summary pages, marketing text, and accreditation details.
      2. SEARCH the detailed pages for the ACTUAL observed values, units, and reference ranges.
      3. Focus specifically on Hematology, Lipid Profile, Liver Function, and Diabetes markers.
      4. LIST only the out-of-range values in a table.
      5. Include a brief clinical interpretation and a medical disclaimer.
      
      REPORT TEXT:
      ${extractedText.substring(0, 30000)} // Limits text to stay within AI context
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ analysis: response.text() });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.status(500).json({ error: "Processing failed.", details: error.message });
  }
});

// Helper for images (since they can't be "parsed" as text)
async function handleImage(req, res) {
    const imagePart = { inlineData: { data: req.file.buffer.toString("base64"), mimeType: req.file.mimetype } };
    const result = await model.generateContent(["Analyze this medical image for out-of-range values.", imagePart]);
    const response = await result.response;
    res.json({ analysis: response.text() });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
