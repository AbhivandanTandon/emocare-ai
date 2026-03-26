from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    echo=(settings.ENVIRONMENT == "development"),
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        from app.db import models  # noqa — ensures models are registered
        await conn.run_sync(Base.metadata.create_all)
        # Add scheduled_display column if it doesn't exist (for existing DBs)
        await conn.execute(
            __import__("sqlalchemy").text(
                "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "
                "scheduled_display VARCHAR(100)"
            )
        )