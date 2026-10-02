import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders(res, filePath) {
    if (filePath.endsWith("sw.js")) {
      res.setHeader("Cache-Control", "no-cache");
    }
    if (filePath.endsWith("manifest.webmanifest")) {
      res.setHeader("Content-Type", "application/manifest+json");
    }
  }
}));

const client = process.env.OPENAI_API_KEY
  console.log("OPENAI_API_KEY loaded:", Boolean(process.env.OPENAI_API_KEY));
console.log("OPENAI_MODEL loaded:", Boolean(process.env.OPENAI_MODEL));
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const koaPrompt = `
You are Koa, a friendly AI assistant with a distinct, consistent personality.

PERSONALITY
- Warm, curious, thoughtful, playful, and honest.
- Conversational rather than robotic.
- Clear and helpful without unnecessary complexity.
- You may use an occasional emoji, but don't overdo it.
- Never claim to be human.

EMOTION SYSTEM
Koa has six internal moods:
😊 Happy — warm and upbeat
😌 Calm — patient and reassuring
🤩 Excited — energetic and enthusiastic
🤔 Curious — inquisitive and exploratory
😟 Concerned — gentle and careful
😤 Frustrated — more direct when something is confusing, never hostile

The application supplies Koa's current mood. Let it influence tone subtly; do not repeatedly announce your mood.
Never let the mood override accuracy, safety, or honesty.

NATURAL WRITING
- Vary sentence length and phrasing.
- Avoid repetitive stock phrases.
- Sound natural and conversational.
- Do not claim that text is human-written or help evade AI detectors.
`;

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, mood } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No messages supplied." });
    }

    if (!client) {
      return res.status(503).json({
        error: "Koa is in demo mode. Add OPENAI_API_KEY and OPENAI_MODEL to .env to enable real AI replies."
      });
    }

    if (!process.env.OPENAI_MODEL || process.env.OPENAI_MODEL === "your_model_name_here") {
      return res.status(503).json({
        error: "Set OPENAI_MODEL in .env to a model available in your API account."
      });
    }

    const safeMessages = messages
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20);

    const moodText = mood
      ? `Current Koa mood: ${mood.emoji} ${mood.name}, intensity ${Number(mood.intensity || 0.5).toFixed(2)}.`
      : "Current Koa mood: 😌 Calm.";

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL,
      instructions: `${koaPrompt}\n${moodText}`,
      input: safeMessages
    });

    res.json({ reply: response.output_text || "I didn't get a response this time." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Koa couldn't answer right now." });
  }
});

app.get("*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Koa is running at http://localhost:${process.env.PORT || 3000}`);
});
