# AIGril Auto Blog Runner Log

## 2026-04-22 10:10 Runner Configured

- 执行器：`scripts/auto_blog_runner.py`
- 单轮提示：`RUNNER_PROMPT.md`
- 状态文件：`RUNNER_STATUS.json`
- 运行策略：本地 runner 负责写作、校验、提交、推送；heartbeat 只读取日志并汇报
- Git 策略：runner 只允许提交博客内容层相关文件
## Runner Iteration Started

- Time: `2026-04-22T10:18:39+08:00`
- Command: `codex exec --cd 'F:\AIGril' --model gpt-5.4 --dangerously-bypass-approvals-and-sandbox --output-last-message 'F:\AIGril\backend\blog_content\auto_blog_runs\2026-04-22-16h-blog-autowriter\last_runner_message.md' -`

## Runner Error

- Time: `2026-04-22T10:18:39+08:00`
- Error: `[WinError 5] 拒绝访问。`

## Runner Iteration Started

- Time: `2026-04-22T10:21:18+08:00`
- Command: `'C:\Users\Lenovo\AppData\Roaming\npm\codex.cmd' exec --cd 'F:\AIGril' --model gpt-5.4 --dangerously-bypass-approvals-and-sandbox --output-last-message 'F:\AIGril\backend\blog_content\auto_blog_runs\2026-04-22-16h-blog-autowriter\last_runner_message.md' -`

## Codex Worker Finished

- Time: `2026-04-22T10:27:58+08:00`
- Exit code: `0`

```text
e controls into Qt because its target user is expected to observe, tune, and compare results repeatedly.
+
+## The Engineering Boundary Is Practical
+
+`CMakeLists.txt` shows the project boundary clearly: CMake 3.10+, C++17, Qt 5 Widgets, OpenCV, Assimp, and Eigen are the main dependencies. OpenMP is used when available for multithreaded rendering. Embree 4 is optional and acts as a CPU ray-occlusion helper path. Build options also cover enabling Embree and storing depth or loaded vertex attributes in half precision.
+
+That dependency mix matches the README's positioning. OpenCV preserves the prototype and image-processing base, Qt provides the desktop shell, Assimp handles asset import, Eigen supports math and half types, and Embree remains an optional hybrid path. The project does not replace its rasterizer with Embree; it keeps rasterization as the main renderer and adds ray-assisted shadows where useful.
+
+The distribution story is also practical. The README recommends a Windows portable package containing `myrender.exe`, runtime DLLs, Qt deployment folders, `Resources`, multilingual README files, license text, and notices. A packaging helper is provided to collect those pieces. For users, this is friendlier than requiring a full source build. For the project, it treats a runnable desktop package as part of engineering quality.
+
+## Summary
+
+haorender's most interesting quality is not a single rendering algorithm. It is the attempt to turn a CPU renderer into an observable, debuggable, and distributable desktop workbench. It keeps the educational and experimental value of software rasterization while adding the parts that make a renderer usable over time: material inspection, shadow tuning, frame-stage profiling, session restore, preset management, and portable release packaging.
+
+Future articles about this project should continue to stay close to public material. Good follow-up topics would be the stage structure of a CPU raster pipeline, the debugging difference between PBR and Stylized Phong, or how portable packaging changes the usability of a desktop rendering tool.
diff --git a/backend/blog_content/posts/zh/haorender-cpu-rendering-workbench.md b/backend/blog_content/posts/zh/haorender-cpu-rendering-workbench.md
new file mode 100644
index 0000000000000000000000000000000000000000..3e62ee7b1057c97d69283806479e18c54fb99481
--- /dev/null
+++ b/backend/blog_content/posts/zh/haorender-cpu-rendering-workbench.md
@@ -0,0 +1,49 @@
+# haorender：把 CPU 光栅化做成可调试的桌面渲染工作台
+
+haorender 的定位很明确：它不是只用来讲解图形学流水线的课堂 Demo，而是一个面向 Windows 桌面的 C++ CPU 渲染工作台。根据项目的 README 和 CMake 配置，它已经把软件光栅化、材质调试、阴影、性能分析、预设管理和 Qt 桌面界面放到同一个工程目标里。
+
+这篇记录只基于低风险材料：`README.md` 和 `CMakeLists.txt`。它不展开源码细节，也不发布本地包、安装文件或私有路径。
+
+## 从渲染器到工作台
+
+项目的主程序目标是 `myrender`，主体验走 Qt 桌面入口，旧的 OpenCV 原型则保留为对照和轻量参考。这说明 haorender 的重心已经从“跑出一张图”转向“持续调试一个渲染系统”。
+
+README 对工程目标的描述很具体：资产加载要可复现，着色流程要可控，渲染状态要可检查，帧阶段耗时要可测量，最终还要能以桌面软件的方式分发。这些目标让它更像一个小型 look-dev 工具，而不是单个算法实验。
+
+这种定位很重要。CPU 渲染器常见的问题不是缺少功能点，而是每个功能都孤立存在：模型加载、材质、光照、阴影、截图、性能分析分散在不同入口里。haorender 试图把这些能力收进一个可反复使用的工作台，让调参和验证成为日常流程。
+
+## CPU 管线仍是核心
+
+haorender 的核心仍然是 CPU 光栅化。README 中列出的管线包括模型、观察、投影和视口变换，裁剪、背面剔除、z-buffer，以及近相机裁剪和 tile binning。后两项尤其有工程味道：它们不是为了展示概念，而是为了避免巨大的屏幕空间三角形拖垮渲染。
+
+阴影部分也不是单一开关。项目支持 raster shadow maps，并提供 near/far 分层级联、split、blend、extent 和 depth range 等控制项。对于 CPU 渲染器来说，这类参数如果只写在代码里会很难调；把它们接入桌面界面和 profiler，才适合持续开发。
+
+着色系统分成三条路线：
+
+- `Realistic PBR`：包含 IBL、金属度、粗糙度、AO、自发光通道重映射、tone mapping 和线性/sRGB 转换。
+- `Stylized Phong`：保留更适合角色和风格化控制的高光、toon-band diffuse、环境光和副光源调节。
+- `Programmable Shader`：提供表达式 DSL，可在桌面 UI 中编辑，并带有编译反馈、示例预设和回退保护。
+
+这三个模式覆盖了不同层次的调试需求。PBR 用来靠近真实材质，Phong 用来保留艺术指导空间，DSL 则把 shader 调试变成更短的交互循环。
+
+## Qt UI 让状态可见
+
+README 描述的桌面界面由多个标签页组成：Workspace、Scene、Shading、Lights、Materials 和 Inspect。它们不是装饰性的面板，而是把渲染器内部状态拆成可以操作的工作区。
+
+Scene 面板负责视场角、曝光、法线强度、内部渲染分辨率、背面剔除和阴影参数。Shading 面板负责 PBR、Stylized Phong 和 Programmable Shader 的模式切换。Lights 面板支持最多三个方向光，并开放 yaw、pitch、intensity 和 RGB。Materials 面板让每个 mesh 的材质和贴图绑定更容易检查。Inspect 面板则把 mesh、triangle、vertex 统计、当前分辨率、Embree 可用性、相机状态和帧 profiler 汇总到一起。
+
+这个 UI 设计的价值在于减少“重新编译才能知道”的次数。渲染器开发经常需要比较不同光照、材质、阴影和分辨率组合；如果每次都要改代码或命令行参数，迭代速度会很慢。haorender 把这些控制面集中在 Qt 里，说明它的目标用户是会反复调试、观察和比较结果的开发者。
+
+## 工程边界比较清楚
+
+`CMakeLists.txt` 体现了项目的工程边界：CMake 3.10+、C++17、Qt 5 Widgets、OpenCV、Assimp、Eigen 是主要依赖；OpenMP 用于可用时的多线程渲染；Embree 4 是可选的 CPU ray occlusion 辅助路径。构建选项还包括是否启用 Embree，以及是否用 half precision 存储深度和顶点属性。
+
+这种依赖组合和 README 中的定位一致。OpenCV 保留了原型和图像处理基础，Qt 提供桌面界面，Assimp 负责模型导入，Eigen 支撑数学和 half 类型，Embree 则作为可选的混合路径存在。项目并没有把 Embree 变成主渲染器，而是把 raster pipeline 保持为主体，这让它仍然是一个 CPU 光栅化工作台。
+
+分发方式也偏务实。README 推荐 Windows portable package：把 `myrender.exe`、运行时 DLL、Qt 部署目录、`Resources`、多语言 README、许可证和 NOTICE 放在同一包里。项目还提供 packaging helper 来整理这些内容。对用户来说，这比要求所有人从源码配置依赖更友好；对作者来说，也能把“可以运行的版本”作为工程质量的一部分来维护。
+
+## 小结
+
+haorender 的特点不是某一个单独的渲染算法，而是把 CPU 渲染器做成了一个可观察、可调试、可分发的桌面工作台。它保留软件光栅化的教学和研究价值，同时补上了真实项目里更容易被忽略的部分：材质检查、阴影调参、帧阶段 profiling、会话恢复、预设管理和便携发布。
+
+如果后续继续写这个项目，更适合展开的方向不是源码全文，而是围绕公开材料做专题：例如 CPU raster pipeline 的阶段划分、PBR 与 Stylized Phong 的调试差异，或者 portable package 对桌面渲染工具可用性的影响。

tokens used
93,676
Project studied: `F:\haorender-main`

Files read: required workflow/status/inventory docs, `backend/blog_content/posts.json`, plus allowed project files `README.md` and `CMakeLists.txt`.

Article slug: `haorender-cpu-rendering-workbench`

Files changed:
- `backend/blog_content/posts/zh/haorender-cpu-rendering-workbench.md`
- `backend/blog_content/posts/en/haorender-cpu-rendering-workbench.md`
- `backend/blog_content/posts.json`
- `backend/blog_content/auto_blog_runs/2026-04-22-16h-blog-autowriter/STATUS.md`
- `backend/blog_content/auto_blog_runs/2026-04-22-16h-blog-autowriter/PROGRESS_LOG.md`

Validation: `posts.json` parses, slug appears once, both Markdown files exist. No Git commands were run. Safety scan found no local absolute paths or obvious secret terms in the new article; source files, binaries, installers, datasets, and private materials were skipped.

```

## Git Commit Created

- Time: `2026-04-22T10:27:58+08:00`
- Commit: `8dae00ea90d7f5a62595bfd05683c6c33dbed65d`
- Files: `8`

## Runner Error

- Time: `2026-04-22T10:28:20+08:00`
- Error: `git fetch origin main failed:
fatal: unable to access 'https://github.com/haowenGuo/AIGril.git/': Failed to connect to github.com port 443 after 21098 ms: Could not connect to server
`

## Runner Iteration Started

- Time: `2026-04-22T10:33:20+08:00`
- Command: `'C:\Users\Lenovo\AppData\Roaming\npm\codex.cmd' exec --cd 'F:\AIGril' --model gpt-5.4 --dangerously-bypass-approvals-and-sandbox --output-last-message 'F:\AIGril\backend\blog_content\auto_blog_runs\2026-04-22-16h-blog-autowriter\last_runner_message.md' -`

## Codex Worker Finished

- Time: `2026-04-22T10:39:10+08:00`
- Exit code: `0`

```text
glue as part of the desktop experience.
+
+That mixed stack is practical. Avatar rendering, chat, and control panels can stay in the TypeScript/Electron world, while ASR, LLM glue, vector memory, and backend services can stay in Python. The two sides can be connected through IPC, HTTP, or a Gateway, with clearer responsibilities than a single-language all-in-one application.
+
+## Packaging Supports the Product Boundary
+
+The README says the repository contains two related deliverables: the HumanClaw desktop app and an OpenClaw Runtime installer shell. The wording matters: the OpenClaw-related part is a runtime packaging and launcher layer, not the full upstream OpenClaw source tree.
+
+That makes the distribution story easier to reason about. HumanClaw can be packaged as a desktop app. The OpenClaw runtime can be prepared as a separate runtime bundle. The two are connected through the Gateway and configuration. For users, this means they can run a lightweight companion mode or connect to a local OpenClaw runtime when they need engineering-task capabilities.
+
+More importantly, the structure avoids tying the desktop pet and the agent engineering platform too tightly together. The desktop side can keep improving windows, avatars, voice, and setup. The runtime side can keep improving sessions, tools, and long-running tasks. The two lines meet through an explicit protocol instead of swallowing each other.
+
+## Summary
+
+The most interesting thing about HumanClaw is its layered boundary. It separates the visible, resident, voice-capable desktop companion from the runtime that handles sessions, tools, and task execution. `package.json` frames it as an Electron/Vite/Three.js desktop product, while `requirements.txt` shows room for Python backend services, voice processing, and assistant infrastructure.
+
+Good follow-up topics should continue to stay close to public material: how a desktop pet reduces the friction of using an AI assistant, how Electron and a Python worker can share a local speech pipeline, and how HumanClaw keeps the OpenClaw Gateway relationship lightweight and replaceable.
diff --git a/backend/blog_content/posts/zh/humanclaw-desktop-pet-openclaw-bridge.md b/backend/blog_content/posts/zh/humanclaw-desktop-pet-openclaw-bridge.md
new file mode 100644
index 0000000000000000000000000000000000000000..5b2448e68cd5a8fb33295a9b84f25a2dce9fc908
--- /dev/null
+++ b/backend/blog_content/posts/zh/humanclaw-desktop-pet-openclaw-bridge.md
@@ -0,0 +1,46 @@
+# HumanClaw：把桌宠界面和 OpenClaw 运行时分清楚
+
+HumanClaw 的定位不是“再做一个完整 Agent 平台”，而是把桌面交互层和后端运行时拆清楚：桌面端负责头像、聊天、托盘、控制面板和语音入口，OpenClaw 则负责会话、事件流、工具执行和长任务编排。这个边界让项目更像一个可以贴近用户日常桌面的 assistant frontend。
+
+这篇记录只基于低风险材料：`README.md`、`package.json` 和 `requirements.txt`。它不展开源码细节，不发布本地安装包，也不复述本机绝对路径或私有配置。
+
+## 桌宠是第一交互面
+
+HumanClaw 的第一层体验是桌面宠物。README 描述的核心能力包括透明 VRM 桌面窗口、独立聊天窗口、托盘与控制面板、首次设置向导，以及本地语音输入和语音输出的桌面 glue。换句话说，它先解决的是“AI 助手如何常驻在桌面上”，而不是直接把所有智能逻辑塞进前端。
+
+从 `package.json` 看，前端技术栈很集中：Vite 负责开发和构建，Electron 负责桌面壳，Three.js 和 `@pixiv/three-vrm` 负责 VRM 头像渲染。这个组合适合做可视化桌面伴侣：浏览器技术负责 UI 和渲染，Electron 负责把窗口、托盘、IPC 和本机能力接起来。
+
+这种设计的价值在于降低交互成本。用户不一定总是想打开完整工程平台，但可能需要一个一直可见、可点开、可说话的入口。HumanClaw 把这个入口做成桌面应用，再把较重的 assistant runtime 放到后面。
+
+## 两种后端模式
+
+README 把运行模式分成两条：
+
+- `companion-service`：桌面宠物连接 companion backend，更适合轻量陪伴、对话和非 OpenClaw 场景。
+- `openclaw-local`：桌面宠物连接本地 OpenClaw Gateway，由 OpenClaw 负责会话、事件流、工具执行和任务编排。
+
+这个拆分很关键。HumanClaw 是桌面 shell，OpenClaw 是 assistant runtime。前者负责用户看得见、摸得到的体验，后者负责更长链路的任务系统。这样做比把所有能力混进一个进程更容易维护，也给后续替换后端、调试 Gateway 或分发桌面端留下空间。
+
+README 还强调 HumanClaw 不替代 OpenClaw Gateway 或 agent system。这是一条健康的工程边界：桌宠可以做得更好看、更顺手、更适合桌面，但它不必重新实现运行时已有的 session、agent 和 tool orchestration。
+
+## Electron、前端和 Python 能力拼在一起
+
+`package.json` 暴露了桌面侧的工作流：开发模式会同时启动 Vite 和 Electron，桌面启动会先构建静态资源再进入 Electron，打包则走 electron-builder 的 Windows NSIS 和 portable 路线。也就是说，HumanClaw 不是纯网页项目，而是以 Electron 桌面应用作为主要交付形态。
+
+`requirements.txt` 则说明 companion backend 不是空壳。它包含 FastAPI、Uvicorn、SQLAlchemy、Pydantic、LangChain、ChromaDB，以及 soundfile、torch、torchaudio、FunASR、ModelScope 等语音相关依赖。结合 README 中“browser microphone capture -> Electron IPC -> Python worker”的描述，可以看出项目把语音链路和本地 Python 能力作为桌面体验的一部分。
+
+这种前后端组合有一个现实优势：头像、聊天和控制面板可以留在 TypeScript/Electron 世界里，ASR、LLM glue、向量记忆或后端服务可以留在 Python 世界里。两边通过 IPC、HTTP 或 Gateway 连接，职责比单语言全包更清楚。
+
+## 打包策略服务于产品边界
+
+README 提到仓库包含两个相关交付物：HumanClaw desktop app，以及 OpenClaw Runtime installer 的打包壳。这里的表述很谨慎：OpenClaw 相关部分是 runtime packaging 和 launcher layer，不是完整上游 OpenClaw 源码树。
+
+这让分发边界更容易理解。HumanClaw 可以作为桌面应用打包；OpenClaw runtime 可以作为单独运行时包准备；两者之间通过 Gateway 和配置连接。对于用户来说，这意味着可以只使用轻量 companion 模式，也可以在需要工程任务能力时接入本地 OpenClaw。
+
+更重要的是，这种结构避免把“桌面宠物”和“Agent 工程平台”绑死。桌面端可以继续优化窗口、头像、语音和设置流程；运行时可以继续优化 session、tools 和长任务。两条线通过明确协议连接，而不是互相吞并。
+
+## 小结
+
+HumanClaw 最值得记录的点，是它把桌面陪伴体验和 assistant runtime 分成了两个层次：前者解决可见、常驻、可说话的用户入口，后者解决会话、工具和任务执行。`package.json` 体现出它是一个 Electron/Vite/Three.js 桌面产品，`requirements.txt` 则说明它仍然保留 Python 后端、语音和智能服务的扩展空间。
+
+后续如果继续写这个项目，更适合围绕公开材料展开三个方向：桌宠交互如何降低 AI 助手的使用摩擦、Electron 与 Python worker 如何配合本地语音链路，以及 HumanClaw 与 OpenClaw 之间如何通过 Gateway 保持轻量而清晰的边界。

tokens used
46,828
One writing iteration completed.

- Project studied: HumanClaw
- Files read: required workflow/status/inventory files; HumanClaw `README.md`, `package.json`, `requirements.txt`; `posts.json`
- Article slug: `humanclaw-desktop-pet-openclaw-bridge`
- Files changed:
  - `backend/blog_content/posts/zh/humanclaw-desktop-pet-openclaw-bridge.md`
  - `backend/blog_content/posts/en/humanclaw-desktop-pet-openclaw-bridge.md`
  - `backend/blog_content/posts.json`
  - `backend/blog_content/auto_blog_runs/2026-04-22-16h-blog-autowriter/STATUS.md`
  - `backend/blog_content/auto_blog_runs/2026-04-22-16h-blog-autowriter/PROGRESS_LOG.md`
- Validation: `posts.json` parses, slug is unique, both body files exist with H1 titles.
- Safety: skipped source files, example subdirectories, installer subdirectory material, binaries, env/secrets, and local absolute path details. No Git commands run.

```

