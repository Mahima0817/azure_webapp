// ===============================
// Campus Navigator - Backend API
// ===============================

import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =====================================
// 1️⃣ Serve the frontend (public folder)
// =====================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend files (index.html, app.js, styles.css)
app.use(express.static(path.join(__dirname, "public")));

// =====================================
// 2️⃣ AI Endpoint (for app.js fetch call)
// =====================================
app.post("/api/genai", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // 🔹 Replace with your Azure OpenAI endpoint
    const endpoint = `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-02-01`;

    // 🔹 Send request to Azure OpenAI
    const response = await axios.post(
      endpoint,
      {
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.AZURE_OPENAI_KEY,
        },
      }
    );

    // 🔹 Return AI result to frontend
    const message = response.data.choices?.[0]?.message?.content || "No response from AI.";
    res.json({ result: message });
  } catch (error) {
    console.error("AI API error:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    res.status(500).json({ error: "AI service error" });
  }
});

// =====================================
// 3️⃣ Start the server
// =====================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Campus Navigator backend running on port ${PORT}`);
});



