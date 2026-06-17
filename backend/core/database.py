from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from backend.core.config import get_settings

settings = get_settings()
Path(settings.DATA_DIR).mkdir(parents=True, exist_ok=True)


def normalize_database_url(database_url: str) -> str:
    """Render Postgres exposes a sync URL; async SQLAlchemy needs asyncpg."""
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return database_url


database_url = normalize_database_url(settings.DATABASE_URL)

# 1. 创建异步引擎 (必须显式导入 create_async_engine)
engine = create_async_engine(
    database_url,
    connect_args={"check_same_thread": False} if "sqlite" in database_url else {},
    echo=settings.DEBUG
)

# 2. 创建会话工厂
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# 3. 基类
Base = declarative_base()


async def init_db():
    """初始化数据库表"""
    async with engine.begin() as conn:
        # 创建所有表
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """依赖注入：获取数据库会话"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
