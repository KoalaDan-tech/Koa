import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.OPENAI_MODEL?.trim();
const API_KEY = process.env.OPENAI_API_KEY?.trim();

// ---------- Startup checks ----------
const isDemoMode = !API_KEY;
if (!isDemoMode && (!MODEL || MODEL === "your_model_name_here")) {
  console.error("❌ OPENAI_MODEL is missing or still set to the placeholder.");
  process.exit(1);
}

const client = isDemoMode ? null : new OpenAI({ apiKey: API_KEY });

console.log(`Koa starting…`);
console.log(`  Mode: ${isDemoMode ? "DEMO (no API key)" : "LIVE"}`);
if (!isDemoMode) console.log(`  Model: ${MODEL}`);

// ---------- Personality ----------
const KOA_SYSTEM_PROMPT = `
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
`.trim();

// ---------- Helpers ----------
function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, 8000), // hard cap per message
    }))
    .slice(-20); // keep only the last 20 turns
}

function formatMood(mood) {
  if (!mood || typeof mood !== "object") {
    return "Current Koa mood: 😌 Calm.";
  }

  const emoji = typeof mood.emoji === "string" ? mood.emoji.slice(0, 4) : "😌";
  const name = typeof mood.name === "string" ? mood.name.slice(0, 20) : "Calm";
  const intensity = Math.min(1, Math.max(0, Number(mood.intensity) || 0.5));

  return `Current Koa mood: ${emoji} ${name}, intensity ${intensity.toFixed(2)}.`;
}

// ---------- App ----------
const app = express();

app.use(express.json({ limit: "1mb" }));

// Static assets
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

// Health check (useful for monitoring / load balancers)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    mode: isDemoMode ? "demo" : "live",
    model: isDemoMode ? null : MODEL,
  });
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    if (isDemoMode) {
      return res.status(503).json({
        error:
          "Koa is in demo mode. Add OPENAI_API_KEY and OPENAI_MODEL to .env to enable real AI replies.",
      });
    }

    const { messages, mood } = req.body ?? {};

    const safeMessages = sanitizeMessages(messages);
    if (safeMessages.length === 0) {
      return res.status(400).json({ error: "No valid messages supplied." });
    }

    const moodText = formatMood(mood);

    const response = await client.responses.create({
      model: MODEL,
      instructions: `${KOA_SYSTEM_PROMPT}\n\n${moodText}`,
      input: safeMessages,
    });

    const reply = response.output_text?.trim() || "I didn't get a response this time.";

    res.json({ reply });
  } catch (error) {
    console.error("[/api/chat]", error?.message || error);

    // Don't leak internal details to the client
    const status = error?.status === 429 ? 429 : 500;
    const message =
      status === 429
        ? "Koa is a bit overwhelmed right now. Please try again in a moment."
        : "Koa couldn't answer right now.";

    res.status(status).json({ error: message });
  }
});

// SPA fallback – must be last
app.get("*splat", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------- Start + graceful shutdown ----------
const server = app.listen(PORT, () => {
  console.log(`✅ Koa is running at http://localhost:${PORT}`);
});

function shutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully…`);
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });

  // Force exit after 10 s if something is stuck
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
