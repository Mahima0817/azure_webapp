const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Load environment variables safely
const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_ID || "";
const apiKey = process.env.AZURE_OPENAI_API_KEY || "";
const apiVersion = "2024-02-15-preview"; // ✅ stable version
const port = process.env.PORT || 3000;

// ✅ Log what’s actually loaded (helps debugging)
console.log("🌍 Loaded Environment Variables:");
console.log({
  endpoint,
  deployment,
  hasKey: !!apiKey,
  apiVersion,
});

// ✅ Test route
app.get("/", (req, res) => {
  res.send("✅ Azure AI backend is running successfully!");
});

// ✅ AI route
app.post("/api/genai", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "⚠️ Missing prompt text" });
    }

    if (!endpoint || !deployment || !apiKey) {
      return res.status(500).json({
        error: "❌ Missing Azure configuration",
        hint: "Please check your environment variables in Azure portal → Configuration",
      });
    }

    // ✅ Build URL correctly
    const cleanEndpoint = endpoint.replace(/\/+$/, "");
    const url = `${cleanEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    console.log("🔹 Sending request to:", url);

    const response = await axios.post(
      url,
      {
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant that provides guidance for campus navigation, explaining routes and decisions clearly.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 250,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      }
    );

    const message =
      response.data?.choices?.[0]?.message?.content || "⚠️ No response received";

    res.json({ result: message });
  } catch (error) {
    console.error("🔥 Azure OpenAI API Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: "Server Error",
      message: error.message,
      azureDetails: error.response?.data || null,
    });
  }
});

app.listen(port, () =>
  console.log(`🚀 Server running successfully on port ${port}`)
);

