// server.js - Express backend that serves static files and handles /api/genai
const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve static frontend files from current directory (wwwroot)
app.use(express.static(path.join(__dirname)));

// Root route fallback
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Load and validate env vars but DO NOT exit; instead disable AI if missing.
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || "";
const AZURE_OPENAI_ENDPOINT = (process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/+$/, "");
const AZURE_OPENAI_DEPLOYMENT_ID = process.env.AZURE_OPENAI_DEPLOYMENT_ID || "";
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-02-01";

const aiEnabled =
  AZURE_OPENAI_API_KEY &&
  AZURE_OPENAI_ENDPOINT &&
  AZURE_OPENAI_DEPLOYMENT_ID &&
  AZURE_OPENAI_API_VERSION;

if (!aiEnabled) {
  console.warn("⚠️ Azure OpenAI not fully configured. /api/genai will return 503 until configured.");
} else {
  console.log("✅ Azure OpenAI configuration detected.");
}

// POST /api/genai
app.post("/api/genai", async (req, res) => {
  if (!aiEnabled) {
    return res.status(503).json({ error: "Azure OpenAI not configured on server." });
  }

  const prompt = req.body?.prompt;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const url = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT_ID}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
    console.log("📡 Calling Azure OpenAI:", url);

    const response = await axios.post(
      url,
      {
        messages: [
          {
            role: "system",
            content:
              "You are a campus navigation assistant. Provide short, clear, human-friendly step-by-step walking directions using left, right, and straight instructions. Avoid using internal node ids.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": AZURE_OPENAI_API_KEY,
        },
        timeout: 20000,
      }
    );

    const result = response.data?.choices?.[0]?.message?.content || "No response from AI.";
    res.json({ result });
  } catch (err) {
    console.error("❌ Azure OpenAI request failed:", err?.response?.data || err.message || err);
    const msg = err?.response?.data?.error?.message || err.message || "Unknown";
    res.status(500).json({ error: "Failed to get AI response", details: msg });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});


