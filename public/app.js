const emotions = {
  happy: {name:"Happy", emoji:"😊", desc:"Warm, upbeat and ready to help."},
  calm: {name:"Calm", emoji:"😌", desc:"Patient, steady and reassuring."},
  excited: {name:"Excited", emoji:"🤩", desc:"Energetic and enthusiastic."},
  curious: {name:"Curious", emoji:"🤔", desc:"Interested and eager to explore."},
  concerned: {name:"Concerned", emoji:"😟", desc:"Gentle, careful and supportive."},
  frustrated: {name:"Frustrated", emoji:"😤", desc:"More direct when something is confusing."}
};

let mood = { key:"happy", intensity:.65 };
let history = [];

const $ = id => document.getElementById(id);
const messages = $("messages");

function renderMood(){
  const e = emotions[mood.key];
  $("moodEmoji").textContent = e.emoji;
  $("moodName").textContent = e.name;
  $("moodDescription").textContent = e.desc;
  $("intensity").textContent = Math.round(mood.intensity*100)+"%";
  $("meterFill").style.width = (mood.intensity*100)+"%";
  document.querySelectorAll(".emotion").forEach(x => x.classList.toggle("active", x.dataset.key === mood.key));
}

function renderEmotionList(){
  $("emotionList").innerHTML = Object.entries(emotions).map(([key,e]) =>
    `<div class="emotion ${key===mood.key?"active":""}" data-key="${key}"><b>${e.emoji} ${e.name}</b>${Math.round(mood.intensity*100)}% mood</div>`
  ).join("");
}

function setMoodFromText(text, isUser=true){
  const t = text.toLowerCase();
  let key = null;
  if (/thank|awesome|great|love|haha|lol|yay/.test(t)) key="happy";
  if (/\?|\bhow\b|\bwhy\b|\bwhat\b|\binteresting\b|\bexplain\b/.test(t)) key="curious";
  if (/excited|amazing|can't wait|wow/.test(t)) key="excited";
  if (/sad|worried|stress|upset|scared|bad day/.test(t)) key="concerned";
  if (/confused|doesn't work|broken|error|wrong/.test(t)) key="frustrated";
  if (!key && !isUser) key="calm";
  if (!key) return;
  if (mood.key === key) mood.intensity = Math.min(1, mood.intensity + .06);
  else { mood.key = key; mood.intensity = .5 + Math.random()*.18; }
  renderMood(); renderEmotionList();
}

function addMessage(role, text){
  const welcome = document.querySelector(".welcome"); if(welcome) welcome.remove();
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = `<div class="avatar">${role==="user"?"You":"🌿"}</div><div class="bubble"></div>`;
  div.querySelector(".bubble").textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

async function sendMessage(text){
  addMessage("user", text);
  history.push({role:"user", content:text});
  setMoodFromText(text, true);
  $("sendBtn").disabled = true;

  const typing = document.createElement("div");
  typing.className = "msg";
  typing.id = "typing";
  typing.innerHTML = `<div class="avatar">🌿</div><div class="bubble typing">Koa is thinking…</div>`;
  messages.appendChild(typing);
  messages.scrollTop = messages.scrollHeight;

  try{
    const res = await fetch("/api/chat", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({messages:history, mood:{name:emotions[mood.key].name,emoji:emotions[mood.key].emoji,intensity:mood.intensity}})
    });
    const data = await res.json();
    $("typing")?.remove();
    if(!res.ok) throw new Error(data.error || "Request failed");
    addMessage("assistant", data.reply);
    history.push({role:"assistant", content:data.reply});
    setMoodFromText(data.reply, false);
  }catch(err){
    $("typing")?.remove();
    addMessage("assistant", "I’m in demo mode right now. " + err.message);
    mood.key="calm"; mood.intensity=.55; renderMood(); renderEmotionList();
  }finally{
    $("sendBtn").disabled = false;
  }
}

$("chatForm").addEventListener("submit", e => {
  e.preventDefault();
  const input = $("input"), text = input.value.trim();
  if(!text) return;
  input.value = ""; input.style.height = "auto";
  sendMessage(text);
});

$("input").addEventListener("keydown", e => {
  if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); $("chatForm").requestSubmit(); }
});
$("input").addEventListener("input", e => { e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,150)+"px"; });

$("clearBtn").addEventListener("click", () => {
  history=[]; mood={key:"happy",intensity:.65}; renderMood(); renderEmotionList();
  messages.innerHTML=`<div class="welcome"><div class="welcome-emoji">🌿</div><h2>Hey, I'm Koa.</h2><p>A curious little AI with six moods. What's on your mind?</p></div>`;
});

renderMood(); renderEmotionList();
