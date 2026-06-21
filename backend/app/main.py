import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.engine import init_db
from app.ml.model_loader import load_models
from app.ml.rag import load_rag

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("emocare")


def create_app() -> FastAPI:
    app = FastAPI(title="EmoCare AI", version="1.0.0", docs_url="/api/docs")

    # Allow the deployed frontend origin (e.g. Vercel) alongside local dev
    frontend_origin = os.getenv("FRONTEND_ORIGIN", "")
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://localhost:3000",
    ]
    if frontend_origin:
        allowed_origins.append(frontend_origin)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.api.routes import auth, chat, admin, appointments
    from app.api.routes import users

    app.include_router(auth.router,         prefix="/api")
    app.include_router(chat.router,         prefix="/api")
    app.include_router(admin.router,        prefix="/api")
    app.include_router(appointments.router, prefix="/api")
    app.include_router(users.router,        prefix="/api")

    @app.on_event("startup")
    async def startup():
        logger.info("Initializing database...")
        await init_db()
        logger.info("Loading ML models...")
        load_models()
        logger.info("Loading RAG knowledge base...")
        load_rag()
        logger.info("EmoCare AI is ready.")

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "service": "emocare-ai"}

    return app


app = create_app()