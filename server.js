// ✅ server.js (Final ES Module version for Azure)
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

console.log("🔍 Environment variables loaded:");
console.log({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_ID,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  hasKey: !!process.env.AZURE_OPENAI_API_KEY,
});

const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/+$/, "");
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_ID;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview";

// Health check
app.get("/", (req, res) => {
  res.send("✅ Azure AI Backend is running fine!");
});

// AI endpoint
app.post("/api/genai", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  console.log("📡 Calling:", url);

  try {
    const response = await axios.post(
      url,
      {
        messages: [
          { role: "system", content: "You are a helpful campus navigation assistant." },
          { role: "user", content: prompt },
        ],
        max_tokens: 150,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      }
    );

    const result = response.data?.choices?.[0]?.message?.content || "No AI response";
    console.log("✅ AI response:", result);
    res.json({ result });
  } catch (error) {
    console.error("❌ Azure OpenAI Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data || {},
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));

