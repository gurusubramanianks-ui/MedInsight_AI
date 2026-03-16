const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// 1. ENABLE CORS FOR ALL ORIGINS (Crucial for Vercel -> Railway)
app.use(cors());

// 2. INCREASE JSON LIMIT (Crucial for high-res images)
app.use(express.json({ limit: '20mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/analyze', async (req, res) => {
    try {
        if (!req.body.fileData) return res.status(400).json({ error: "No file data" });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const base64Data = req.body.fileData.split(',')[1];
        const mimeType = req.body.fileData.split(';')[0].split(':')[1];

        const prompt = `Act as a medical lab interpreter. 1. Identify name. 2. List 'What you need to look into' (Out of range) with the phrase 'Your [Test] looks above/below range, you might need medications, exercise and a change in diet'. 3. List 'Whats looking Good'. 4. List 'Action Items'. 5. Add a health fact about India and a motivational quote. Format as clean HTML.`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType } }
        ]);

        res.json({ htmlContent: result.response.text() });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Health check to verify Railway is awake
app.get('/', (req, res) => res.send("MedInsight is live and accepting connections!"));


});
