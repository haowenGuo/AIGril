<div align="center">
  <h1>AIGril</h1>
  <p><strong>A browser-based virtual companion project starring AIGL, with a 3D VRM avatar, streaming chat, expressive animation, and lightweight memory.</strong></p>
  <p>
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

## Overview

AIGL is the main character of AIGril, designed to feel lively, responsive, and expressive on the web.

- A live 3D VRM avatar rendered directly in the browser
- Streamed text replies for lower perceived latency
- Action and expression control driven by model-generated tags
- Lip sync, blink, idle motion, and dance motion systems
- Session memory with periodic summary compression

## Experience

- Full experience: [https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com](https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com)
- Frontend-only demo: [https://haowenGuo.github.io/AIGril/](https://haowenGuo.github.io/AIGril/)
- Backend API docs: [https://airi-backend.onrender.com/docs](https://airi-backend.onrender.com/docs)

## Core Features

- Streaming chat responses from a FastAPI backend
- VRM avatar actions such as idle, dance, surprise, wave, and anger
- Expression presets such as happy, sad, relaxed, surprised, and playful blink
- Speaking-state animation and lip-sync fallback while text is arriving
- Memory storage and timed summary compression for longer conversations

## Tech Stack

- Frontend: Vite, Three.js, `@pixiv/three-vrm`
- Backend: FastAPI, SQLAlchemy, SQLite
- Model access: OpenAI-compatible API
- Deployment: GitHub Pages + Render

## Run Locally

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

## PC Desktop App

```bash
pnpm desktop:dev
pnpm desktop:start
pnpm desktop:pack
pnpm desktop:dist
```

The desktop app uses Electron to load the existing Vite frontend. It defaults to the public backend at `https://airi-backend.onrender.com`; set `AIGRIL_BACKEND_URL` to use a local FastAPI backend. See [`docs/pc-desktop.md`](docs/pc-desktop.md) for details.

## AIGL Resource Harvesting

```bash
python scripts/harvest_aigl_resources.py --kind motion --limit 5
python scripts/harvest_aigl_resources.py --kind music-text --limit 5
python scripts/harvest_aigl_resources.py --kind motion --source curated-commercial --download --download-review-motion-packs --limit 50
```

The harvester uses public APIs and writes candidate manifests by default instead of downloading files. See [`docs/resource-harvesting.md`](docs/resource-harvesting.md) for details.

## Repository Layout

```text
backend/   FastAPI API, memory logic, deployment config
src/       VRM avatar, chat UI, actions, expressions, frontend runtime
Resources/ VRM model and VRMA animation assets
scripts/   Static build helpers
examples/  Standalone developer examples, including the Python safety API demo
```

## Deployment

- Public frontend: GitHub Pages
- Public backend: Render
- Render config: [`render.yaml`](render.yaml)

## Goal

Build a virtual character experience that feels responsive, expressive, and pleasant to interact with on the web, while keeping the project easy to evolve.
