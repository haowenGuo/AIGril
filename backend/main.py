from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import uvicorn

from backend.core.config import get_settings
from backend.core.database import init_db
from backend.api.chat import router as chat_router
from backend.api.tts import router as tts_router
from backend.AISafety import router as ai_safety_router
# 🔴 导入新的压缩服务（而不是从 chat.py 导入）
from backend.services.compress_service import timer_task_runner

settings = get_settings()

# 全局持有定时器任务，避免被垃圾回收
timer_task: asyncio.Task | None = None


# ---------------- 统一的 Lifespan 生命周期（替代 on_event） ----------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global timer_task

    # 1. 服务启动前：初始化数据库
    print(f"🚀 启动 {settings.APP_NAME}...")
    await init_db()
    print("✅ 数据库初始化完成")

    # 2. 服务启动前：开启记忆压缩定时器
    if not timer_task or timer_task.done():
        timer_task = asyncio.create_task(timer_task_runner())
        print("✅ 记忆压缩计时器启动成功")

    print("✅ 服务启动成功！")

    # 3. 正式对外提供服务
    yield

    # 4. 服务关闭后：安全停止定时器
    if timer_task and not timer_task.done():
        timer_task.cancel()
        await timer_task
        print("✅ 记忆压缩计时器已安全关闭")


# ---------------- 创建 FastAPI 实例 ----------------
app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,  # 🔴 挂载统一的 lifespan
    debug=settings.DEBUG
)

# ---------------- 配置 CORS (解决跨域) ----------------
cors_allow_origins = settings.get_cors_allow_origins() or ["*"]
allow_credentials = cors_allow_origins != ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    # 浏览器不允许 credentials 与通配符 * 同时使用，这里根据配置自动切换。
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- 注册路由（只保留一次） ----------------
app.include_router(chat_router, prefix="/api", tags=["对话"])
app.include_router(tts_router, prefix="/api", tags=["语音"])
app.include_router(ai_safety_router, prefix="/api", tags=["安全"])


# ---------------- 根路径测试 ----------------
@app.get("/")
async def root():
    return {"message": "AIGril Backend is running", "docs": "/docs"}


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)
