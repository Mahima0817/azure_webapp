// ✅ server.js (works with Azure + "type": "module")
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Read env vars
const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/+$/, "");
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_ID;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview";
const port = process.env.PORT || 3000;

console.log("Environment variables loaded:", {
  endpoint,
  deployment,
  apiVersion,
  hasKey: !!apiKey,
});

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("✅ Azure AI backend running fine!");
});

// ✅ AI endpoint route
app.post("/api/genai", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt required" });

    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    console.log("Calling Azure OpenAI:", url);

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

    const message = response.data?.choices?.[0]?.message?.content || "No response";
    res.json({ result: message });
  } catch (error) {
    console.error("Azure OpenAI Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data,
    });
  }
});

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));

