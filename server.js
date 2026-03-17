require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini (Ensure GEMINI_API_KEY is in Railway Variables)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// 1. JSON Test Route (Use this to test connection)
app.get('/test', (req, res) => {
  res.json({ 
    status: "Success", 
    message: "Backend is communicating in JSON!" 
  });
});

// 2. Catch-all for the root URL
app.get('/', (req, res) => {
  res.send("Server is running. Please use the /test endpoint for API calls.");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server active on port ${PORT}`);
});
