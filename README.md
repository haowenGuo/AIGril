# AIRI

AIRI 是一个以 VRM 数字人形象为核心的陪伴式虚拟角色项目，包含：

- Three.js + `@pixiv/three-vrm` 驱动的前端数字人界面
- FastAPI 后端对话服务
- 短期记忆、定时记忆压缩、可选 RAG
- ElevenLabs 一次性整段 TTS 生成
- 文本、音频、口型、动作、表情的联动控制

## 项目特点

- 完整对话链路：用户消息 -> 后端上下文 -> LLM 回复 -> ElevenLabs 语音 -> 前端角色播放
- 模块分离：对话、TTS、表情/动作、音频播放、前端聊天服务分层清晰
- 纯文本降级：TTS 不可用时，仍会显示文字并触发 fallback 口型
- GitHub Pages 体验模式：即使不启动后端，打开网页也能先体验角色界面、动作、表情和文本口型
- GitHub 发布就绪：附带 Pages 自动部署工作流、README、环境变量示例和依赖清单

## 目录结构

```text
AIGril/
├─ backend/                     # FastAPI 后端
│  ├─ api/                      # 对话 / TTS 路由
│  ├─ core/                     # 配置、数据库
│  ├─ models/                   # SQLAlchemy 模型
│  └─ services/                 # LLM / memory / RAG / TTS / markup
├─ src/                         # 前端模块
│  ├─ app.js
│  ├─ chat-service.js           # 真实后端 / GitHub Pages demo 的统一服务层
│  ├─ chat-tts-system.js
│  ├─ config.js
│  ├─ tts-audio-player.js
│  └─ vrm-model-system.js
├─ Resources/                   # VRM 模型与 VRMA 动作资源
├─ scripts/                     # 构建辅助脚本
├─ .github/workflows/           # GitHub Pages 发布工作流
├─ package.json
├─ requirements.txt
└─ README.md
```

## 功能清单

### 1. 数字人界面

- 加载 VRM 模型
- 播放 idle / dance / wave / angry / surprised 等动作
- 调用统一表情预设接口
- 表情在一段时间后自动回归 `neutral`
- 自动眨眼与情绪表情互斥，避免叠加冲突

### 2. 文本与语音联动

- 后端一次性生成整段文本
- 同一段文本一次性发送给 ElevenLabs 生成整段音频
- 使用 ElevenLabs `with-timestamps` 返回字符级对齐信息
- 前端依据真实音频能量驱动口型
- 如果缺少音频或 TTS 失败，自动退化为文本口型模拟

### 3. 记忆系统

- 对话上下文存入数据库
- 定时扫描数据库中的会话
- 超过阈值后调用 LLM 压缩旧消息摘要
- 摘要以 `system` 消息回灌到后续上下文

### 4. GitHub Pages 体验模式

- GitHub Pages 默认不连接 FastAPI 后端
- 页面会自动进入 demo 模式
- demo 模式仍可体验：
  - 模型加载
  - 动作和表情触发
  - 自动搭话
  - 文本逐字显示
  - fallback 口型动画

## 本地启动

### 前端

```bash
pnpm install
pnpm dev
```

默认地址：

```text
http://localhost:5173
```

### 后端

1. 创建并激活虚拟环境
2. 安装依赖
3. 复制环境变量

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy backend\.env.example backend\.env
```

4. 填写 `backend/.env`

必须至少配置：

```env
LLM_API_KEY=your_llm_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_voice_id
```

5. 启动 FastAPI

```bash
python -m uvicorn backend.main:app --reload
```

默认地址：

```text
http://localhost:8000
```

接口文档：

```text
http://localhost:8000/docs
```

## GitHub Pages 发布

仓库已经带上了 `.github/workflows/deploy-pages.yml`。推送到 `main` 后：

1. 打开仓库 `Settings -> Pages`
2. 把 Source 设成 `GitHub Actions`
3. 等待 Actions 工作流完成

如果仓库名为 `AIGril`，GitHub Pages 地址通常会是：

```text
https://haowenGuo.github.io/AIGril/
```

### Pages 体验模式说明

GitHub Pages 只负责静态前端体验，因此默认进入 demo 模式，不会直接运行 FastAPI。

如果你后续把后端部署到别的域名，可以在 Pages 地址后面附带：

```text
?backend=https://your-backend-domain.com
```

前端会优先连接这个后端地址，而不是本地 `localhost:8000`。

## ElevenLabs 配置

本项目的 TTS 设计是“整段文本一次性送入 ElevenLabs”，目的是：

- 保留整句韵律和音色一致性
- 让前端拿到整段音频和完整时间戳
- 减少分片 TTS 带来的音色跳变

相关环境变量：

```env
ELEVENLABS_API_BASE=https://api.elevenlabs.io
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_voice_id
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
```

## 发布注意事项

- 不要把真实密钥提交到 GitHub
- `backend/.env`、数据库文件、Chroma 数据、`dist/` 均已加入 `.gitignore`
- GitHub Pages 适合前端静态体验，不直接承载当前这套 FastAPI 后端
- 如果你拥有 GitHub Spark 访问权限，可以后续考虑把在线全栈体验迁移到 Spark

## 建议的 GitHub 提交说明

```text
feat: publish AIRI with GitHub Pages demo and modular TTS architecture
```

建议提交说明覆盖：

- 前端 VRM 数字人系统
- FastAPI 对话 / TTS / 记忆压缩
- ElevenLabs 整段 TTS
- GitHub Pages demo 模式
- 本地运行与部署方式
