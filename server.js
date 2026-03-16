const cors = require('cors');
app.use(cors());
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const app = express();
app.use(express.json({ limit: '10mb' }));

const genAI = new GoogleGenerativeAI("AIzaSyCQm8OZHDtOpmWeN5I1f-uy7EbMhvh8lkM");

app.post('/analyze', async (req, res) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // The System Prompt based on your Requirements #6, #7, #8
    const prompt = `
    Extract data from this medical report. 
    1. Identify the name in the report.
    2. List "What you need to look into": Find out-of-range results. For each, say: "[Marker] is above/below range. You might need medications, exercise and a change in diet. Please consult [Specialist] and a Nutritionist."
    3. List "Whats looking Good": Summarize in-range results.
    4. List "Action Items": Specific steps based on medical standards.
    5. Add a "Daily Inspiration": Use a random stat about health in India, a positive quote, and a sportsman's quote (e.g., Sachin Tendulkar or MS Dhoni).
    6. Mention: "References: icmr.org.in, who.int"
    Format the output as clean HTML.
    `;

    try {
        // Gemini handles the image/PDF directly
        const result = await model.generateContent([prompt, { inlineData: { data: req.body.fileData.split(',')[1], mimeType: "image/jpeg" } }]);
        res.json({ htmlContent: result.response.text() });
    } catch (error) {
        res.status(500).json({ error: "AI Processing Error" });
    }
});

app.listen(process.env.PORT || 3000);
