import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Create Groq client ONCE
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "Care Connect backend running" });
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { history = [], message, systemInstruction } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Build conversation text safely
    const conversation = [
      `SYSTEM:\n${systemInstruction}`,
      ...history.map(h => `${h.role.toUpperCase()}: ${h.content}`),
      `USER: ${message}`
    ].join("\n\n");

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",  // ✅ Current Groq production model
      messages: [
        {
          role: "user",
          content: conversation,
        },
      ],
      temperature: 0.7,
    });

    res.json({
      text: response.choices[0]?.message?.content ?? "",
    });

  } catch (error) {
    console.error("🔥 GEMINI GENERATE FAILED:", error);
    res.status(500).json({ error: "Gemini service failed" });
  }
});




app.listen(PORT, () => {
  console.log(`✅ Backend listening on http://localhost:${PORT}`);
});
