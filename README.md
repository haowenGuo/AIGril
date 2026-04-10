# AIRI

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

AIRI is a browser-based virtual companion built around a 3D VRM avatar, streaming chat, expressive animation, and lightweight memory features.

## Try It

- Full experience: [https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com](https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com)
- Frontend-only demo: [https://haowenGuo.github.io/AIGril/](https://haowenGuo.github.io/AIGril/)
- Backend API docs: [https://airi-backend.onrender.com/docs](https://airi-backend.onrender.com/docs)

## What AIRI Does

- Renders a live 3D VRM avatar in the browser
- Streams chat replies from a FastAPI backend
- Triggers avatar actions and expressions from model-generated control tags
- Plays idle, dance, surprise, anger, and other motion presets
- Runs lip sync, blink, and speaking-state animation for more natural feedback
- Stores session memory and periodically compresses old conversations into summaries

## Highlights

- Fast text-first interaction with streamed output
- Expressive character behavior instead of plain text-only chat
- Public deployment with GitHub Pages for the frontend and Render for the backend
- Clean module split between avatar system, chat system, and backend services

## Stack

- Frontend: Vite, Three.js, `@pixiv/three-vrm`
- Backend: FastAPI, SQLAlchemy, SQLite
- Model access: OpenAI-compatible API
- Deployment: GitHub Pages + Render

## Run Locally

### Frontend

```bash
pnpm install
pnpm dev
```

### Backend

```bash
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

## Structure

```text
backend/   FastAPI API, memory logic, deployment config
src/       VRM avatar, chat UI, actions, expressions, frontend runtime
Resources/ VRM model and VRMA animation assets
scripts/   Static build helpers
```

## Deployment

- Public frontend: GitHub Pages
- Public backend: Render
- Render config: [`render.yaml`](render.yaml)

## Goal

Make a virtual character feel responsive, expressive, and pleasant to interact with on the web while keeping the project approachable for future iteration.
