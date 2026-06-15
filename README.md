<div align="center">
  <h1>AIGril / AIGRIL</h1>
  <p><strong>An embodied AI companion project centered on AIGL: a 3D virtual character, a conversational runtime, a desktop pet, and an extensible set of education, memory, voice, and safety services.</strong></p>
  <p>
    <a href="https://haowenGuo.github.io/AIGril/about-aigl.html"><img alt="AIGRIL Showcase" src="https://img.shields.io/badge/AIGRIL-Showcase%20%26%20Downloads-73b8e5?style=for-the-badge"></a>
    <a href="https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com"><img alt="Try AIGril" src="https://img.shields.io/badge/Try%20AIGril-Live%20Experience-2563eb?style=for-the-badge"></a>
    <a href="https://haowenGuo.github.io/AIGril/"><img alt="Frontend Demo" src="https://img.shields.io/badge/GitHub%20Pages-Frontend%20Demo-0f172a?style=for-the-badge"></a>
    <a href="https://airi-backend.onrender.com/docs"><img alt="Backend API" src="https://img.shields.io/badge/Backend-FastAPI%20Docs-059669?style=for-the-badge"></a>
  </p>
  <p>
    <a href="README.md">English</a> ·
    <a href="README.zh-CN.md">简体中文</a> ·
    <a href="README.ja.md">日本語</a>
  </p>
</div>

---

<p align="center">
  <img width="743" height="491" alt="AIGril browser experience" src="https://github.com/user-attachments/assets/80361901-7adc-459b-bc9a-ed9aa4d0a5f1" />
  <img width="566" height="389" alt="AIGril desktop companion" src="https://github.com/user-attachments/assets/4fdc700c-ea8b-41da-a1ae-98c6f33ff626" />
</p>

## What Is AIGRIL?

AIGril is the repository and product surface. AIGL is the character and interaction core.

The project asks a simple question: what if an AI assistant did not live only in a chat box? AIGRIL explores an assistant that has a visible body, persistent presence, expressive motion, voice, memory, and enough system structure to grow into practical daily workflows.

It is part virtual companion, part desktop pet, part AI application framework. The goal is not only to make a cute avatar answer messages, but to build a more natural interface for AI: one that can be seen, spoken to, remembered, embedded into teaching scenes, and extended into tools.

## Purpose

AIGRIL is built around three ideas:

- Embodiment: the assistant should feel present through a 3D VRM avatar, facial expressions, motion, speaking states, and voice.
- Continuity: conversations should not be isolated events; memory, summaries, and session context should help the assistant keep track of the user over time.
- Practicality: the same character should work as a web experience, a desktop companion, an AI teacher, and a service-backed application that can be deployed and iterated.

## Core Modules

| Area | What It Does |
| --- | --- |
| Character runtime | Loads the AIGL VRM model, controls VRMA motions, expression presets, idle behavior, speaking animation, blink behavior, and fallback lip-sync. |
| Web experience | Provides the browser-facing 3D chat interface through Vite, Three.js, and `@pixiv/three-vrm`. |
| Desktop pet | Packages AIGL as an Electron app with a transparent always-on-top pet window, separate chat window, tray controls, saved position/scale, local ASR, and speech options. |
| Conversation backend | Uses FastAPI for streaming chat, model access, conversation persistence, RAG context, reply markup, and periodic memory compression. |
| Simulated classroom | Provides an `/edu` teaching surface with student and teacher accounts, diagnostics, question bank, assignments, classroom sessions, blackboard content, and AI teacher dialogue. |
| Content system | Includes a bilingual blog/project writing pipeline used to publish project notes, development logs, and technical essays. |
| Safety API | Exposes moderation and safety-check endpoints that return both aggregate risk decisions and detailed algorithm results. |
| Deployment layer | Uses GitHub Pages for the public frontend, Render for the backend, and Electron Builder/GitHub Actions for desktop packages. |

## Product Direction

AIGRIL is moving toward an embodied assistant platform rather than a single demo.

- From chat UI to embodied interface: the avatar, motion, voice, and emotion layer are treated as first-class interaction primitives.
- From one-time answers to long-term companionship: memory and summary compression are part of the core backend instead of an afterthought.
- From browser demo to daily workspace: the desktop pet keeps AIGL visible and close to the user without requiring a full browser page.
- From general chat to scenario systems: the simulated classroom shows how AIGL can become a teacher, guide, or role-specific agent.
- From isolated frontend to deployable product: the project keeps packaging, backend services, docs, and content publishing in the same ecosystem.

## Experience Links

- Project showcase and downloads: [https://haowenGuo.github.io/AIGril/about-aigl.html](https://haowenGuo.github.io/AIGril/about-aigl.html)
- Full web experience: [https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com](https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com)
- Frontend-only demo: [https://haowenGuo.github.io/AIGril/](https://haowenGuo.github.io/AIGril/)
- Backend API docs: [https://airi-backend.onrender.com/docs](https://airi-backend.onrender.com/docs)
- Simulated classroom: [https://airi-backend.onrender.com/edu](https://airi-backend.onrender.com/edu)
- Project writing/blog: [https://airi-backend.onrender.com/blog](https://airi-backend.onrender.com/blog)

## Downloads

- Windows public package: [HumanClaw Setup 1.0.4](https://github.com/haowenGuo/AIGril/releases/download/v1.0.4/HumanClaw-Setup-1.0.4-win-x64.exe) or [HumanClaw Portable 1.0.4](https://github.com/haowenGuo/AIGril/releases/download/v1.0.4/HumanClaw-Portable-1.0.4-win-x64.exe).
- Linux public packages: [AppImage](https://github.com/haowenGuo/AIGril/releases/download/v1.0.3/AIGril-1.0.3-linux-x86_64.AppImage), [Debian .deb](https://github.com/haowenGuo/AIGril/releases/download/v1.0.3/AIGril-1.0.3-linux-amd64.deb), or [tar.gz](https://github.com/haowenGuo/AIGril/releases/download/v1.0.3/AIGril-1.0.3-linux-x64.tar.gz).
- Note: Windows `v1.0.4` is public; Linux packages remain on AIGril `v1.0.3` until a public HumanClaw Linux build is published.

## Architecture

```text
Resources/   AIGL VRM model and VRMA motion assets
src/         Browser runtime, VRM system, chat panel, TTS/audio, desktop render entry
electron/    Desktop pet shell, preload bridge, tray/menu logic, state persistence, local ASR worker
backend/     FastAPI app, chat, memory, RAG, TTS, safety, blog, education, Vivix routes
docs/        Simulated classroom delivery and iteration notes
scripts/     Static build and publishing helpers
examples/    Standalone developer examples
```

## Technology

- Frontend: Vite, Three.js, `@pixiv/three-vrm`, `@pixiv/three-vrm-animation`
- Desktop: Electron, Electron Builder, local Python ASR worker
- Backend: FastAPI, SQLAlchemy, SQLite
- AI integration: OpenAI-compatible chat API, RAG service, memory compression, safety service
- Deployment: GitHub Pages, Render, GitHub Actions

## Run Locally

### Web

```bash
pnpm install
pnpm dev
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy backend\.env.example backend\.env
python -m uvicorn backend.main:app --reload
```

Required environment variable:

```env
LLM_API_KEY=your_llm_api_key
```

### Desktop Pet

```bash
pnpm install
python -m pip install -r requirements-desktop-asr.txt
pnpm desktop:start
```

Desktop notes:

- Local speech recognition is optional and only used by the Electron build.
- The desktop ASR path uses a local Python worker with Whisper Small.
- The first ASR run may download and cache the speech model.
- On Linux, the desktop pet defaults to X11 because Electron has limits around programmatic window positioning on Wayland.

### Desktop Development

```bash
pnpm desktop:dev
```

## Packaging

```bash
pnpm desktop:package:win
pnpm desktop:package:linux
pnpm desktop:package:mac:x64
pnpm desktop:package:mac:arm64
```

Generated desktop artifacts are written to `release/`. For repeatable multi-platform builds, use [`.github/workflows/build-desktop-packages.yml`](.github/workflows/build-desktop-packages.yml).

## Long-Term Vision

AIGRIL aims to become a warm but capable AI presence: a character that can accompany, teach, remember, speak, appear on the desktop, and eventually connect to more tools and workflows without losing the feeling of a coherent person-like interface.
