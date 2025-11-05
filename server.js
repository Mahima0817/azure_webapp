const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Load environment variables
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/+$/, "") + "/";
const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

// ✅ Quick check for missing environment variables
if (!apiKey || !endpoint || !deploymentId || !apiVersion) {
  console.error("❌ Missing one or more required environment variables.");
  console.log({
    AZURE_OPENAI_API_KEY: apiKey ? "Loaded" : "Missing",
    AZURE_OPENAI_ENDPOINT: endpoint || "Missing",
    AZURE_OPENAI_DEPLOYMENT_ID: deploymentId || "Missing",
    AZURE_OPENAI_API_VERSION: apiVersion || "Missing",
  });
  process.exit(1);
}

// ✅ Route: Generate AI directions
app.post("/api/genai", async (req, res) => {
  const prompt = req.body.prompt;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const url = `${endpoint}openai/deployments/${deploymentId}/chat/completions?api-version=${apiVersion}`;
    console.log("📡 Calling Azure OpenAI:", url);

    const response = await axios.post(
      url,
      {
        messages: [
          {
            role: "system",
            content:
              "You are a campus navigation assistant. Provide clear, step-by-step walking directions using left, right, and straight instructions.",
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

    const result = response.data.choices?.[0]?.message?.content || "No response from AI.";
    console.log("✅ AI response received.");
    res.json({ result });
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message || String(error);
    console.error("❌ Azure OpenAI error:", msg);
    res.status(500).json({ error: "Failed to get AI response", details: msg });
  }
});

// ✅ Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Backend running on port ${port}`);
});



