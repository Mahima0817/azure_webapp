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
// 1️⃣ Serve the frontend
// =====================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// If your frontend files (index.html, app.js) are in project root:
app.use(express.static(__dirname));

// =====================================
// 2️⃣ AI Endpoint
// =====================================
app.post("/api/genai", async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log("📥 Prompt received:", prompt);

    const endpoint = `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_ID}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION}`;
    console.log("🔗 Endpoint called:", endpoint);

    const response = await axios.post(
      endpoint,
      {
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.AZURE_OPENAI_API_KEY,
        },
      }
    );

    console.log("✅ Azure Response:", response.data);
    const message =
      response.data.choices?.[0]?.message?.content || "No response from AI.";
    res.json({ result: message });
  } catch (error) {
    console.error("🔥 AI API error:", error.message);
    if (error.response) console.error("Response data:", error.response.data);
    res.status(500).json({ error: "AI service error" });
  }
});


    const message =
      response.data.choices?.[0]?.message?.content || "No response from AI.";
    res.json({ result: message });
  } catch (error) {
    console.error("AI API error:", error.message);
    if (error.response) console.error("Response data:", error.response.data);
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




