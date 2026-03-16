const express = require('express');
const cors = require('cors'); // Essential for connection
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors()); // Allow all origins for the MVP
app.use(express.json({ limit: '20mb' })); // Increased limit for high-res images

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/analyze', async (req, res) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Convert Base64 back to raw data for Gemini
        const base64Data = req.body.fileData.split(',')[1];
        const mimeType = req.body.fileData.split(';')[0].split(':')[1];

        const prompt = "Act as a medical lab interpreter. Extract data from this report. 1. Identify patient name. 2. List 'What you need to look into' (Out of range results) with your specific explanation including 'You might need medications, exercise and a change in diet'. 3. List 'Whats looking Good' (In range). 4. List 'Action Items'. 5. Add a statistical health fact about India and a motivational quote from a famous sportsperson. Format as clean HTML.";

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
