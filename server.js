// ✅ server.js (ESM-compatible, Azure-ready)

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =====================================
// 🔍 Debug log: Check environment values
// =====================================
console.log("🔍 Environment variables loaded:");
console.log({
  AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY ? "✅ Present" : "❌ Missing",
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
  AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION,
});

// =====================================
// ✅ Load environment variables
// =====================================
const apiKey = process.env.AZURE_OPENAI_KEY;
const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/+$/, "");
const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview";

if (!apiKey || !endpoint || !deploymentId) {
  console.error("❌ Missing one or more required environment variables:");
  console.log({
    AZURE_OPENAI_KEY: !!apiKey,
    AZURE_OPENAI_ENDPOINT: endpoint,
    AZURE_OPENAI_DEPLOYMENT: deploymentId,
  });
  process.exit(1);
}

// =====================================
// ✅ Health check route
// =====================================
app.get("/", (req, res) => {
  res.send("✅ Campus Navigator backend is running successfully on Azure!");
});

// =====================================
// ✅ AI route - calls Azure OpenAI
// =====================================
app.post("/api/genai", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  const url = `${endpoint}/openai/deployments/${deploymentId}/chat/completions?api-version=${apiVersion}`;
  console.log("📡 Calling Azure OpenAI:", url);

  try {
    const response = await axios.post(
      url,
      {
        messages: [
          {
            role: "system",
            content:
              "You are a campus navigation assistant. Provide clear, friendly, step-by-step walking directions in simple English.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 150,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        timeout: 10000, // ⏳ 10s timeout
      }
    );

    const result = response.data?.choices?.[0]?.message?.content || "No AI response.";
    console.log("✅ AI response received.");
    res.json({ result });
  } catch (error) {
    console.error("❌ Azure OpenAI error:", error.response?.data || error.message);

    if (error.response?.status === 503) {
      return res.status(503).json({
        error: "Azure OpenAI service temporarily unavailable. Please try again shortly.",
      });
    }

    res.status(500).json({
      error: "Failed to get AI response",
      details: error.response?.data || error.message,
    });
  }
});

// =====================================
// ✅ Start the server
// =====================================
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Backend running on port ${port}`));

