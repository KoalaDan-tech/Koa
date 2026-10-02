import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 4000;

app.use(express.json({ limit: "1mb" }));
app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders(res, filePath) {
      if (filePath.endsWith("sw.js")) {
        res.setHeader("Cache-Control", "no-cache");
      }
      if (filePath.endsWith("manifest.webmanifest")) {
        res.setHeader("Content-Type", "application/manifest+json");
      }
    },
  })
);

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const MODEL = process.env.OPENAI_MODEL?.trim();
const hasValidModel = Boolean(MODEL && MODEL !== "your_model_name_here");

const KOA_PROMPT = `You are Koa, a friendly AI assistant with a distinct, consistent personality.

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
- Do not claim that text is human-written or help evade AI detectors.`;

const VALID_MOODS = new Set([
  "Happy",
  "Calm",
  "Excited",
  "Curious",
  "Concerned",
  "Frustrated",
]);

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_CONTENT_LENGTH).trim(),
    }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_MESSAGES);
}

function sanitizeMood(mood) {
  if (!mood || typeof mood !== "object") {
    return { name: "Calm", emoji: "😌", intensity: 0.5 };
  }
  const name = VALID_MOODS.has(mood.name) ? mood.name : "Calm";
  const emoji =
    typeof mood.emoji === "string" && mood.emoji.length <= 8
      ? mood.emoji
      : "😌";
  let intensity = Number(mood.intensity);
  if (!Number.isFinite(intensity)) intensity = 0.5;
  intensity = Math.min(1, Math.max(0, intensity));
  return { name, emoji, intensity };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    ai: Boolean(client && hasValidModel),
    demo: !(client && hasValidModel),
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const safeMessages = sanitizeMessages(req.body?.messages);
    if (safeMessages.length === 0) {
      return res.status(400).json({ error: "No valid messages supplied." });
    }

    if (!client) {
      return res.status(503).json({
        error:
          "Koa is in demo mode. Add OPENAI_API_KEY and OPENAI_MODEL to .env to enable real AI replies.",
      });
    }

    if (!hasValidModel) {
      return res.status(503).json({
        error:
          "Set OPENAI_MODEL in .env to a model available in your API account.",
      });
    }

    const mood = sanitizeMood(req.body?.mood);
    const moodText = `Current Koa mood: ${mood.emoji} ${mood.name}, intensity ${mood.intensity.toFixed(2)}.`;

    const response = await client.responses.create({
      model: MODEL,
      instructions: `${KOA_PROMPT}\n${moodText}`,
      input: safeMessages,
    });

    const reply =
      (typeof response.output_text === "string" && response.output_text.trim()) ||
      "I didn't get a response this time.";

    res.json({ reply });
  } catch (error) {
    console.error("[koa/chat]", error?.message || error);
    const status = error?.status === 429 ? 429 : 500;
    const message =
      status === 429
        ? "Koa is a bit busy right now. Try again in a moment."
        : "Koa couldn't answer right now.";
    res.status(status).json({ error: message });
  }
});

app.get("*splat", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Koa is running at http://localhost:${PORT}`);
  if (!client || !hasValidModel) {
    console.log("Demo mode: set OPENAI_API_KEY and OPENAI_MODEL in .env for live replies.");
  }
});
