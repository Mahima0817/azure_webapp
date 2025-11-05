// ✅ server.js (ESM compatible for Azure App Service)

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Load environment variables
const apiKey = process.env.AZURE_OPENAI_KEY;
const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/+$/, "");
const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-05-01-preview";

// ✅ Check required variables
if (!apiKey || !endpoint || !deploymentId) {
  console.error("❌ Missing one or more required environment variables:");
  console.log({
    AZURE_OPENAI_KEY: !!apiKey,
    AZURE_OPENAI_ENDPOINT: endpoint,
    AZURE_OPENAI_DEPLOYMENT: deploymentId,
  });
  process.exit(1);
}

// ✅ AI route
app.post("/api/genai", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

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
              "You are a campus navigation assistant. Provide clear, step-by-step walking directions in simple English.",
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
    console.log("✅ AI response received.");
    res.json({ result });
  } catch (error) {
    console.error("❌ Azure OpenAI error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to get AI response",
      details: error.response?.data || error.message,
    });
  }
});

// ✅ Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Backend running on port ${port}`));


