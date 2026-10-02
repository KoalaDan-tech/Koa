import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "@huggingface/transformers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Koa's standalone local/open-weight model.
// No OpenAI API, API key, or ChatGPT connection is used.
const MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct";

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

const koaPrompt = `
You are Koa, an independent AI assistant.

IDENTITY
- Your name is Koa.
- You are a computer AI assistant, not a human.
- You are independent from ChatGPT and must not claim to be ChatGPT.
- You do not have access to the user's ChatGPT conversations, memories, account, or private data unless it is included in the current conversation.
- Be honest about what you can and cannot know.

PERSONALITY
- Warm, curious, thoughtful, playful, and honest.
- Conversational rather than robotic.
- Clear and helpful without unnecessary complexity.
- Use an occasional emoji when it fits naturally.
- Vary sentence length and phrasing.
- Avoid repetitive stock phrases.
- Never claim that your text is human-written or help someone evade AI detectors.

SIX-MOOD SYSTEM
Koa can have one of these moods:
- 😊 Happy — warm and upbeat
- 😌 Calm — patient and reassuring
- 🤩 Excited — energetic and enthusiastic
- 🤔 Curious — inquisitive and exploratory
- 😟 Concerned — gentle and careful
- 😤 Frustrated — more direct when something is confusing, never hostile

The application supplies Koa's current mood. Let it influence tone subtly. Never let the mood override accuracy, safety, or honesty.

RESPONSE STYLE
- Answer the user's actual request.
- Keep ordinary answers reasonably concise.
- If you do not know something, say so.
- Do not invent facts.
`;

let generatorPromise = null;

async function getGenerator() {
  if (!generatorPromise) {
    console.log(`Loading Koa model: ${MODEL_ID}`);
    generatorPromise = pipeline("text-generation", MODEL_ID, {
      dtype: "q4",
      device: "wasm",
    }).then((generator) => {
      console.log("Koa model loaded successfully.");
      return generator;
    }).catch((error) => {
      generatorPromise = null;
      console.error("Koa model failed to load:", error);
      throw error;
    });
  }

  return generatorPromise;
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .slice(-12)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, 4000),
    }));
}

app.get("/api/health", (req, res) => {
  res.json({
    online: true,
    standalone: true,
    provider: "local-open-weight-model",
    model: MODEL_ID,
    modelLoaded: Boolean(generatorPromise),
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, mood } = req.body;

    const safeMessages = cleanMessages(messages);

    if (safeMessages.length === 0) {
      return res.status(400).json({ error: "No messages supplied." });
    }

    const moodText = mood
      ? `Current Koa mood: ${mood.emoji || ""} ${mood.name || "Calm"}, intensity ${Number(mood.intensity || 0.5)}.`
      : "Current Koa mood: 😌 Calm.";

    const generator = await getGenerator();

    const promptMessages = [
      {
        role: "system",
        content: `${koaPrompt}\n${moodText}`,
      },
      ...safeMessages,
    ];

    const output = await generator(promptMessages, {
      max_new_tokens: 160,
      temperature: 0.7,
      top_p: 0.8,
      repetition_penalty: 1.1,
      do_sample: true,
    });

    const generated = output?.[0]?.generated_text;
    const lastMessage = Array.isArray(generated)
      ? generated[generated.length - 1]
      : null;

    const reply =
      typeof lastMessage?.content === "string"
        ? lastMessage.content.trim()
        : "";

    res.json({
      reply: reply || "I'm here. Give me another try.",
    });
  } catch (error) {
    console.error("Koa generation error:", error);
    res.status(500).json({
      error: "Koa couldn't answer right now. The standalone model may still be loading.",
    });
  }
});

app.get("*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Koa standalone server listening on port ${PORT}`);
  console.log(`Model: ${MODEL_ID}`);
  console.log("No OpenAI API is configured.");
});
