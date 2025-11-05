// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Load environment variables
const apiKey = process.env.AZURE_OPENAI_KEY; // renamed to match Azure env var
const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/+$/, "");
const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT; // renamed for clarity
const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-05-01-preview";

// ✅ Check for missing variables
if (!apiKey || !endpoint || !deploymentId) {
  console.error("❌ Missing one or more required environment variables:");
  console.log({
    AZURE_OPENAI_KEY: !!apiKey,
    AZURE_OPENAI_ENDPOINT: endpoint,
    AZURE_OPENAI_DEPLOYMENT: deploymentId,
  });
  process.exit(1);
}

// ✅ AI Route
app.post("/api/genai", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const url = `${endpoint}/openai/deployments/${deploymentId}/chat/completions?api-version=${apiVersion}`;
    console.log("📡 Calling Azure OpenAI:", url);

    const response = await axios.post(
      url,
      {
        messages: [
          {
            role: "system",
            content:
              "You are a helpful campus navigation assistant. Explain walking routes clearly in a friendly tone.",
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
      }
    );

    const result = response.data?.choices?.[0]?.message?.content || "No AI response.";
    res.json({ result });
  } catch (error) {
    console.error("❌ Azure OpenAI error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to get AI response",
      details: error.response?.data || error.message,
    });
  }
});

// ✅ Start server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Backend running on port ${port}`));

