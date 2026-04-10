<div align="center">
  <h1>AIRI</h1>
  <p><strong>一个以 3D VRM 虚拟角色为核心的网页陪伴项目，强调流式对话、动作表情联动，以及轻量记忆能力。</strong></p>
  <p>
    <a href="https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com"><img alt="Try AIRI" src="https://img.shields.io/badge/Try%20AIRI-完整体验-2563eb?style=for-the-badge"></a>
    <a href="https://haowenGuo.github.io/AIGril/"><img alt="Frontend Demo" src="https://img.shields.io/badge/GitHub%20Pages-前端展示-0f172a?style=for-the-badge"></a>
    <a href="https://airi-backend.onrender.com/docs"><img alt="Backend API" src="https://img.shields.io/badge/Backend-FastAPI%20文档-059669?style=for-the-badge"></a>
  </p>
  <p>
    <a href="README.md">English</a> ·
    <a href="README.zh-CN.md">简体中文</a> ·
    <a href="README.ja.md">日本語</a>
  </p>
</div>

---

## 项目简介

AIRI 的重点是让网页中的虚拟角色更像“正在陪你互动”的存在。

- 在浏览器中渲染实时 3D VRM 虚拟角色
- 通过 FastAPI 后端流式输出文本回复
- 根据模型生成的控制标签驱动动作和表情
- 支持口唇、眨眼、待机动作和跳舞动作
- 支持会话记忆与定时摘要压缩

## 在线体验

- 完整体验版：[https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com](https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com)
- 纯前端展示版：[https://haowenGuo.github.io/AIGril/](https://haowenGuo.github.io/AIGril/)
- 后端接口文档：[https://airi-backend.onrender.com/docs](https://airi-backend.onrender.com/docs)

## 核心功能

- 流式文本对话，降低等待体感
- 虚拟角色动作控制，如待机、跳舞、惊讶、挥手、生气
- 表情预设，如开心、难过、放松、惊讶、俏皮眨眼
- 在文本到达过程中执行说话状态动画和 fallback 口型
- 会话记忆存储与定时摘要压缩

## 技术栈

- 前端：Vite、Three.js、`@pixiv/three-vrm`
- 后端：FastAPI、SQLAlchemy、SQLite
- 大模型接入：OpenAI 兼容接口
- 部署：GitHub Pages + Render

## 本地启动

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

让网页中的虚拟角色既有较快响应速度，也有足够自然的表现力，同时保持项目结构清晰，方便继续迭代。
