# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AIGril is a browser-based virtual companion featuring AIGL, a 3D VRM avatar with streaming chat, expressive animations, lip-sync, and session memory. Full-stack: Vite frontend + FastAPI backend.

## Commands

### Frontend
```bash
pnpm install          # install dependencies
pnpm dev              # dev server at localhost:5173
pnpm build            # production build to dist/
pnpm preview          # preview production build at localhost:4173
```

### Backend
```bash
python -m venv .venv
.venv\Scripts\activate                          # Windows
pip install -r requirements.txt
copy backend\.env.example backend\.env          # then fill in LLM_API_KEY
uvicorn backend.main:app --reload               # dev server at localhost:8000
```

Backend can also be started from inside `backend/` directly (`python main.py`); the config loader handles both working directories.

## Architecture

### Frontend (`src/`)
Pure ES6 modules, no framework. Entry point is `src/app.js` loaded by `index.html`.

- `vrm-model-system.js` — Three.js scene, VRM model loading via `@pixiv/three-vrm`, animation mixer, lip-sync, blink, expression presets
- `chat-service.js` — streaming fetch to backend, parses control tags (`[action:wave]`, `[expression:happy]`) from LLM output, demo-mode fallback for GitHub Pages
- `chat-tts-system.js` — orchestrates VRM + audio + chat; triggers animations from parsed tags; auto-chat idle mode
- `tts-audio-player.js` — ElevenLabs audio playback with lip-sync mouth morphing
- `config.js` — VRM model path, animation file list (15 VRMA files in `Resources/`), camera defaults, expression presets, backend URL detection from query params / localStorage

### Backend (`backend/`)
FastAPI async app. Entry: `backend/main.py`.

Key endpoints:
- `POST /api/chat` — streaming chat (SSE)
- `POST /api/chat/tts` — chat + TTS audio
- `POST /api/chat/text` — text-only response
- `POST /api/safety/check` — content moderation

Service layer (`backend/services/`):
- `llm_service.py` — LangChain + OpenAI-compatible API (default: Volcano Engine Doubao model)
- `memory_service.py` — per-session conversation storage in SQLite
- `compress_service.py` — background timer that summarizes old messages when threshold hit
- `rag_service.py` — optional Chroma vector search (disabled by default)
- `tts_service.py` — ElevenLabs TTS with alignment data
- `ai_safety_service.py` — content moderation via separate or shared LLM

Config: `backend/core/config.py` loads from `backend/.env` via pydantic-settings. All LLM/TTS/memory settings are there.

Database: SQLite + aiosqlite, models in `backend/models/db_models.py` (Conversation, Document tables).

### Control Tag Protocol
The LLM generates inline tags at the start of replies that the frontend parses and strips:
- Actions: `[action:wave]`, `[action:angry]`, `[action:surprised]`, `[action:dance]`
- Expressions: `[expression:happy]`, `[expression:sad]`, `[expression:surprised]`, `[expression:relaxed]`, `[expression:blinkRight]`

These are defined in the system prompt (`SYSTEM_PROMPT` in config.py) and parsed by `chat-service.js`.

## Deployment

- Frontend: GitHub Pages via `.github/workflows/deploy-pages.yml` (push to main triggers build)
- Backend: Render via `render.yaml` (Python 3.11.11, 5GB persistent disk for SQLite/Chroma)

## Key Conventions

- Python 3.11, async throughout the backend (async def, await, aiosqlite)
- Frontend uses ES6 module imports, no bundler plugins beyond Vite
- Package manager is pnpm (pinned 10.33.0)
- Environment secrets go in `backend/.env` (never committed); see `backend/.env.example`
- The VRM model file is `Resources/AiGril.vrm`; animations are `.vrma` files in `Resources/`
- The system prompt is in Chinese and defines AIGL's persona; it lives in `backend/core/config.py`
