import ssl
import re
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# asyncpg does not support sslmode= or ssl= in the URL — strip them and pass ssl via connect_args
_db_url = re.sub(r"[?&]sslmode=[^&]*", "", settings.DATABASE_URL)
_db_url = re.sub(r"[?&]ssl=[^&]*", "", _db_url)
_db_url = _db_url.rstrip("?&")

_connect_args = {}
if any(k in settings.DATABASE_URL for k in ("neon.tech", "ssl=require", "sslmode=require")):
    _ssl_ctx = ssl.create_default_context()
    _connect_args["ssl"] = _ssl_ctx

engine = create_async_engine(
    _db_url,
    pool_size=10,
    max_overflow=20,
    echo=(settings.ENVIRONMENT == "development"),
    connect_args=_connect_args,
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