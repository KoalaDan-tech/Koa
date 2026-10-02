const emotions = {
  happy: {
    name: "Happy",
    emoji: "😊",
    desc: "Warm, upbeat and ready to help.",
  },
  calm: {
    name: "Calm",
    emoji: "😌",
    desc: "Patient, steady and reassuring.",
  },
  excited: {
    name: "Excited",
    emoji: "🤩",
    desc: "Energetic and enthusiastic.",
  },
  curious: {
    name: "Curious",
    emoji: "🤔",
    desc: "Interested and eager to explore.",
  },
  concerned: {
    name: "Concerned",
    emoji: "😟",
    desc: "Gentle, careful and supportive.",
  },
  frustrated: {
    name: "Frustrated",
    emoji: "😤",
    desc: "More direct when something is confusing.",
  },
};

const MOOD_RULES = [
  {
    key: "happy",
    pattern: /thank|awesome|great|love|haha|lol|yay|nice|wonderful|glad/i,
  },
  {
    key: "curious",
    pattern: /\?|\bhow\b|\bwhy\b|\bwhat\b|\binteresting\b|\bexplain\b|\btell me\b/i,
  },
  {
    key: "excited",
    pattern: /excited|amazing|can't wait|wow|incredible|fantastic/i,
  },
  {
    key: "concerned",
    pattern: /sad|worried|stress|upset|scared|bad day|anxious|hurt/i,
  },
  {
    key: "frustrated",
    pattern: /confused|doesn't work|broken|error|wrong|stuck|annoying/i,
  },
];

const STORAGE_KEY = "koa-mood-v1";
const MAX_HISTORY = 40;

let mood = loadMood() || { key: "happy", intensity: 0.65 };
let history = [];
let abortController = null;
let isSending = false;

const $ = (id) => document.getElementById(id);
const messagesEl = $("messages");
const inputEl = $("input");
const sendBtn = $("sendBtn");
const chatForm = $("chatForm");
const clearBtn = $("clearBtn");

function loadMood() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && emotions[parsed.key] && Number.isFinite(parsed.intensity)) {
      return {
        key: parsed.key,
        intensity: Math.min(1, Math.max(0, parsed.intensity)),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveMood() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mood));
  } catch {
    /* ignore */
  }
}

function renderMood() {
  const e = emotions[mood.key];
  $("moodEmoji").textContent = e.emoji;
  $("moodName").textContent = e.name;
  $("moodDescription").textContent = e.desc;
  $("intensity").textContent = `${Math.round(mood.intensity * 100)}%`;
  $("meterFill").style.width = `${mood.intensity * 100}%`;
  document.querySelectorAll(".emotion").forEach((el) => {
    el.classList.toggle("active", el.dataset.key === mood.key);
  });
}

function renderEmotionList() {
  $("emotionList").innerHTML = Object.entries(emotions)
    .map(
      ([key, e]) =>
        `<div class="emotion${key === mood.key ? " active" : ""}" data-key="${key}" role="listitem">
          <b>${e.emoji} ${e.name}</b>
          <span class="emotion-hint">${key === mood.key ? `${Math.round(mood.intensity * 100)}%` : e.desc}</span>
        </div>`
    )
    .join("");
}

function setMoodFromText(text, isUser = true) {
  const t = text.toLowerCase();
  let key = null;

  for (const rule of MOOD_RULES) {
    if (rule.pattern.test(t)) {
      key = rule.key;
      break;
    }
  }

  if (!key && !isUser) key = "calm";
  if (!key) return;

  if (mood.key === key) {
    mood.intensity = Math.min(1, mood.intensity + 0.06);
  } else {
    mood.key = key;
    mood.intensity = 0.5 + Math.random() * 0.18;
  }

  saveMood();
  renderMood();
  renderEmotionList();
}

function addMessage(role, text) {
  const welcome = messagesEl.querySelector(".welcome");
  if (welcome) welcome.remove();

  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.setAttribute("role", "listitem");

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "user" ? "You" : "🌿";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  div.append(avatar, bubble);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function showTyping() {
  const typing = document.createElement("div");
  typing.className = "msg";
  typing.id = "typing";
  typing.setAttribute("aria-live", "polite");
  typing.innerHTML =
    '<div class="avatar" aria-hidden="true">🌿</div><div class="bubble typing">Koa is thinking…</div>';
  messagesEl.appendChild(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return typing;
}

function removeTyping() {
  $("typing")?.remove();
}

async function sendMessage(text) {
  if (isSending || !text.trim()) return;

  isSending = true;
  sendBtn.disabled = true;
  addMessage("user", text);
  history.push({ role: "user", content: text });
  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
  }
  setMoodFromText(text, true);

  if (abortController) abortController.abort();
  abortController = new AbortController();

  showTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify({
        messages: history,
        mood: {
          name: emotions[mood.key].name,
          emoji: emotions[mood.key].emoji,
          intensity: mood.intensity,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    removeTyping();

    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }

    const reply = data.reply || "I didn't get a response this time.";
    addMessage("assistant", reply);
    history.push({ role: "assistant", content: reply });
    setMoodFromText(reply, false);
  } catch (err) {
    removeTyping();
    if (err.name === "AbortError") return;

    const message =
      err.message || "Something went wrong. Please try again.";
    addMessage("assistant", message);
    mood.key = "calm";
    mood.intensity = 0.55;
    saveMood();
    renderMood();
    renderEmotionList();
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

function resetChat() {
  if (abortController) abortController.abort();
  history = [];
  mood = { key: "happy", intensity: 0.65 };
  saveMood();
  renderMood();
  renderEmotionList();
  messagesEl.innerHTML = `
    <div class="welcome">
      <div class="welcome-emoji" aria-hidden="true">🌿</div>
      <h2>Hey, I'm Koa.</h2>
      <p>A curious little AI with six moods. What's on your mind?</p>
    </div>`;
  inputEl.focus();
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = "";
  inputEl.style.height = "auto";
  sendMessage(text);
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

inputEl.addEventListener("input", (e) => {
  e.target.style.height = "auto";
  e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
});

clearBtn.addEventListener("click", resetChat);

messagesEl.setAttribute("role", "list");
renderMood();
renderEmotionList();
