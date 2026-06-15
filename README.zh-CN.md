<div align="center">
  <h1>AIGril / AIGRIL</h1>
  <p><strong>以 AIGL 为核心的具身 AI 陪伴项目：3D 虚拟角色、对话运行时、桌面宠物，以及可扩展的教育、记忆、语音与安全服务。</strong></p>
  <p>
    <a href="https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com"><img alt="Try AIGril" src="https://img.shields.io/badge/Try%20AIGril-在线体验-2563eb?style=for-the-badge"></a>
    <a href="https://haowenGuo.github.io/AIGril/"><img alt="Frontend Demo" src="https://img.shields.io/badge/GitHub%20Pages-前端演示-0f172a?style=for-the-badge"></a>
    <a href="https://airi-backend.onrender.com/docs"><img alt="Backend API" src="https://img.shields.io/badge/Backend-FastAPI%20文档-059669?style=for-the-badge"></a>
  </p>
  <p>
    <a href="README.md">English</a> ·
    <a href="README.zh-CN.md">简体中文</a> ·
    <a href="README.ja.md">日本語</a>
  </p>
</div>

---

<p align="center">
  <img width="743" height="491" alt="AIGril 网页体验" src="https://github.com/user-attachments/assets/80361901-7adc-459b-bc9a-ed9aa4d0a5f1" />
  <img width="566" height="389" alt="AIGril 桌面陪伴形态" src="https://github.com/user-attachments/assets/4fdc700c-ea8b-41da-a1ae-98c6f33ff626" />
</p>

## AIGRIL 是什么？

AIGril 是仓库和产品表面，AIGL 是角色和交互核心。

这个项目想回答一个很直接的问题：如果 AI 助手不只存在于聊天框里，会是什么样子？AIGRIL 探索的是一种可见、可说话、会记忆、有动作表情、能常驻桌面，也能进入具体场景的 AI 交互形态。

它既是虚拟陪伴项目，也是桌面宠物和 AI 应用框架的雏形。目标不是简单做一个会回答问题的可爱头像，而是把“角色”变成 AI 的入口：能被看见、能被呼唤、能延续上下文、能进入教学和工具场景，并且可以持续工程化扩展。

## 项目目的

AIGRIL 围绕三个核心想法构建：

- 具身化：助手应该有可感知的存在感，包含 3D VRM 形象、表情、动作、说话状态和语音。
- 连续性：对话不应该是一次性的孤立问答，记忆、摘要压缩和会话上下文应该帮助助手长期理解用户。
- 实用性：同一个角色可以运行在网页、桌面、仿真课堂和后端服务中，既能陪伴，也能承接实际任务。

## 核心内容

| 模块 | 作用 |
| --- | --- |
| 角色运行时 | 加载 AIGL 的 VRM 模型，驱动 VRMA 动作、表情预设、待机状态、说话动画、眨眼和 fallback 口型。 |
| 网页体验 | 通过 Vite、Three.js 和 `@pixiv/three-vrm` 提供浏览器里的 3D 对话界面。 |
| 桌面宠物 | 用 Electron 把 AIGL 打包为透明置顶桌宠，包含独立聊天窗、托盘控制、位置/缩放记忆、本地 ASR 和语音模式。 |
| 对话后端 | 使用 FastAPI 支撑流式对话、模型接入、会话存储、RAG 上下文、回复标记和周期性记忆压缩。 |
| 仿真课堂 | 提供 `/edu` 教学入口，包含学生/教师账号、学情诊断、题库、作业、课堂会话、黑板内容和 AI 教师对话。 |
| 内容系统 | 内置中英文博客和项目写作管线，用于发布项目记录、开发日志和技术文章。 |
| 安全接口 | 提供内容安全检测接口，返回综合风险判定和多路算法细节。 |
| 部署与分发 | 前端使用 GitHub Pages，后端使用 Render，桌面端通过 Electron Builder 和 GitHub Actions 打包。 |

## 项目方向

AIGRIL 的方向不是停留在单一演示，而是逐步走向“具身 AI 助手平台”。

- 从聊天 UI 走向具身交互：虚拟形象、动作、语音和情绪不只是装饰，而是交互的一部分。
- 从一次性回答走向长期陪伴：记忆和摘要压缩是后端核心能力，而不是附加功能。
- 从网页演示走向日常桌面：桌宠形态让 AIGL 能靠近用户的真实工作流。
- 从泛聊天走向场景系统：仿真课堂展示了 AIGL 作为教师、引导者或角色型 Agent 的可能性。
- 从前端玩具走向可部署产品：项目把前端、后端、打包、部署、文档和内容发布放在同一生态里持续迭代。

## 体验入口

- 完整网页体验：[https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com](https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com)
- 纯前端演示：[https://haowenGuo.github.io/AIGril/](https://haowenGuo.github.io/AIGril/)
- 后端 API 文档：[https://airi-backend.onrender.com/docs](https://airi-backend.onrender.com/docs)
- 仿真课堂入口：[https://airi-backend.onrender.com/edu](https://airi-backend.onrender.com/edu)
- 项目写作/博客：[https://airi-backend.onrender.com/blog](https://airi-backend.onrender.com/blog)

## 架构地图

```text
Resources/   AIGL 的 VRM 模型与 VRMA 动作资源
src/         浏览器运行时、VRM 系统、聊天面板、TTS/音频、桌面端渲染入口
electron/    桌宠外壳、preload 桥接、托盘/菜单、状态持久化、本地 ASR worker
backend/     FastAPI 应用、聊天、记忆、RAG、TTS、安全、博客、教育、Vivix 路由
docs/        仿真课堂交付与迭代记录
scripts/     静态构建与发布辅助脚本
examples/    独立开发示例
```

## 技术栈

- 前端：Vite、Three.js、`@pixiv/three-vrm`、`@pixiv/three-vrm-animation`
- 桌面端：Electron、Electron Builder、本地 Python ASR worker
- 后端：FastAPI、SQLAlchemy、SQLite
- AI 接入：OpenAI 兼容对话接口、RAG 服务、记忆压缩、安全服务
- 部署：GitHub Pages、Render、GitHub Actions

## 本地运行

### 网页版

```bash
pnpm install
pnpm dev
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy backend\.env.example backend\.env
python -m uvicorn backend.main:app --reload
```

至少需要配置：

```env
LLM_API_KEY=your_llm_api_key
```

### 桌宠版

```bash
pnpm install
python -m pip install -r requirements-desktop-asr.txt
pnpm desktop:start
```

桌宠说明：

- 本地语音识别是 Electron 桌面端的可选能力。
- 当前桌面端 ASR 使用本地 Python worker 和 Whisper Small。
- 首次使用 ASR 时可能会自动下载并缓存语音模型。
- Linux 桌宠默认使用 X11，因为 Electron 在 Wayland 下对程序化窗口定位有限制。

### 桌宠开发模式

```bash
pnpm desktop:dev
```

## 打包

```bash
pnpm desktop:package:win
pnpm desktop:package:linux
pnpm desktop:package:mac:x64
pnpm desktop:package:mac:arm64
```

桌面端产物会输出到 `release/`。如果需要稳定的多平台构建，可以使用 [`.github/workflows/build-desktop-packages.yml`](.github/workflows/build-desktop-packages.yml)。

## 长期愿景

AIGRIL 想成为一个温柔但有能力的 AI 存在：它能陪伴、教学、记忆、说话、常驻桌面，也能逐渐连接更多工具和工作流，同时保持一个连贯的角色型交互体验。
