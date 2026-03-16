const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// 1. INITIALIZE CORS FIRST
// This allows your Vercel frontend to communicate with this Railway backend
app.use(cors());

// 2. CONFIGURE BODY PARSER
// Increased to 20mb to handle high-resolution medical report images/PDFs
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// 3. INITIALIZE GEMINI AI
// Ensure GEMINI_API_KEY is set in your Railway 'Variables' tab
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 4. THE ANALYSIS ROUTE
app.post('/analyze', async (req, res) => {
    try {
        const { fileData } = req.body;

        if (!fileData) {
            return res.status(400).json({ error: "No file data provided." });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Prepare the Base64 data for Gemini
        const base64Data = fileData.split(',')[1];
        const mimeType = fileData.split(';')[0].split(':')[1];

        // The specific prompt based on your requirements
        const prompt = `
            Act as a professional medical report interpreter. 
            Analyze the provided report image/document and return the following sections in clean HTML:

            1. <h3>What you need to look into</h3>
               List all test results that are OUT OF RANGE. For each, use the phrase: 
               "Your [Test Name] looks above/below range, you might need medications, exercise and a change in diet to bring back to normal. Please consult a Specialist Doctor and a Nutritionist."
            
            2. <h3>Whats looking Good</h3>
               List all test results that are WITHIN RANGE and explain briefly what they mean for health.

            3. <h3>Action Items</h3>
               Provide a bulleted list of prioritized actions based on medical standards.

            4. <h3>Daily Inspiration</h3>
               - Provide one interesting health statistic about India.
               - Provide a motivational sentence: "Be positive and enjoy your life with a better version of you."
               - Include a quote from a famous sportsman (e.g., Sachin Tendulkar, MS Dhoni, or Mary Kom).

            5. <p><strong>References:</strong> icmr.org.in, who.int, nlm.nih.gov</p>

            Disclaimer: Include a note that this is an AI recommendation and not a diagnosis.
        `;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType } }
        ]);

        const responseText = await result.response.text();
        
        // Return the HTML content to the frontend
        res.json({ htmlContent: responseText });

    } catch (error) {
        console.error("AI Analysis Error:", error);
        res.status(500).json({ error: "Analysis failed: " + error.message });
    }
});

// 5. ROOT ROUTE (For Health Checks)
app.get('/', (req, res) => {
    res.send("MedInsight AI Backend is running perfectly.");
});

// 6. START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`MedInsight Engine active on port ${PORT}`);
});
