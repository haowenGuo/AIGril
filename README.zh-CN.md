# AIRI

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

AIRI 是一个以 3D VRM 虚拟角色为核心的网页陪伴项目，强调流式对话、角色动作表情联动，以及轻量记忆能力。

## 在线体验

- 完整体验版：[https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com](https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com)
- 纯前端展示版：[https://haowenGuo.github.io/AIGril/](https://haowenGuo.github.io/AIGril/)
- 后端接口文档：[https://airi-backend.onrender.com/docs](https://airi-backend.onrender.com/docs)

## AIRI 能做什么

- 在浏览器中渲染实时 3D VRM 虚拟角色
- 通过 FastAPI 后端流式输出文本回复
- 根据模型生成的控制标签触发动作和表情
- 播放待机、跳舞、惊讶、生气等动作
- 执行口唇、眨眼和说话状态动画，让反馈更自然
- 保存会话记忆，并定时把旧对话压缩成摘要

## 项目亮点

- 以流式文本为核心，交互等待感更低
- 不只是聊天框，而是有动作和表情反馈的虚拟角色
- 前端部署在 GitHub Pages，后端部署在 Render，可直接公开体验
- 数字人系统、聊天系统、后端服务模块拆分清晰

## 技术栈

- 前端：Vite、Three.js、`@pixiv/three-vrm`
- 后端：FastAPI、SQLAlchemy、SQLite
- 大模型接入：OpenAI 兼容接口
- 部署：GitHub Pages + Render

## 本地启动

### 前端

```bash
pnpm install
pnpm dev
```

### 后端

```bash
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

## 项目结构

```text
backend/   FastAPI 接口、记忆逻辑、部署配置
src/       VRM 数字人、聊天界面、动作表情与前端运行时
Resources/ VRM 模型与 VRMA 动作资源
scripts/   静态构建辅助脚本
```

## 部署方式

- 公开前端：GitHub Pages
- 公开后端：Render
- Render 配置文件：[`render.yaml`](render.yaml)

## 项目目标

让网页中的虚拟角色既有较快的响应速度，也有足够自然的表现力，同时保持代码结构清晰，便于继续迭代。
