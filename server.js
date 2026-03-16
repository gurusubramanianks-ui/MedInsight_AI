const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// FIX: CORS must be initialized before any routes
app.use(cors({
  origin: '*', // Allows access from any domain (Vercel, Localhost, etc.)
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Handle large medical report images
app.use(express.json({ limit: '20mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/analyze', async (req, res) => {
    console.log("Received analysis request...");
    try {
        if (!req.body.fileData) return res.status(400).json({ error: "No file uploaded" });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const base64Data = req.body.fileData.split(',')[1];
        const mimeType = req.body.fileData.split(';')[0].split(':')[1];

        const prompt = `Act as a medical lab interpreter. Identify the patient name. 
        List 'What you need to look into' (Out of range) and use the phrase: 'Your [Test] looks above/below range, you might need medications, exercise and a change in diet'. 
        List 'Whats looking Good' (In range). List 'Action Items'. 
        Add a random health stat about India and a motivational quote from a sportsperson. 
        Format as clean HTML.`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType } }
        ]);

        res.json({ htmlContent: result.response.text() });
    } catch (error) {
        console.error("Gemini Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/', (req, res) => res.send("MedInsight Server is Online"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
