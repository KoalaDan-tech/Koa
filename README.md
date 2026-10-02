# Koa AI Website

A small full-stack website for Koa: a chat assistant with six moods.

## Run it

1. Install Node.js.
2. Open a terminal in this folder.
3. Run:

```bash
npm install
```

4. Copy `.env.example` to `.env`.
5. Put your own API key in `OPENAI_API_KEY`.
6. Set `OPENAI_MODEL` to a model available in your API account.
7. Start Koa:

```bash
npm start
```

8. Open `http://localhost:3000`.

The API key stays on the server. Do not put it in `public/app.js` or any browser code.

## Mood system

Koa has:
- 😊 Happy
- 😌 Calm
- 🤩 Excited
- 🤔 Curious
- 😟 Concerned
- 😤 Frustrated

The browser changes Koa's mood gradually from conversation signals and sends the current mood to the server so it can influence the assistant's tone.

This project intentionally aims for natural conversation, not AI-detector evasion.


## PWA installation

Koa is now a Progressive Web App.

When hosted over HTTPS, compatible browsers can install it:
- Android Chrome/Edge: use the browser's install/add-to-home-screen option.
- iPhone/iPad Safari: Share → Add to Home Screen.
- Desktop Chrome/Edge: use the install icon in the address bar when available.

The included `beforeinstallprompt` handler also shows an **Install Koa** button on browsers that expose the install prompt.

### Important

The AI chat still needs an internet connection and a working server/API. The service worker caches the Koa interface so the shell can load when offline, but it cannot generate AI responses without the backend.

For a public website, deploy the Node server behind HTTPS and use your own domain. Keep `OPENAI_API_KEY` in the server environment, never in browser JavaScript.
