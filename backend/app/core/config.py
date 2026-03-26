from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str
    ENCRYPTION_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    TEXT_MODEL_PATH:  str = "models/text_model"
    AUDIO_MODEL_PATH: str = "models/audio_model/wavlm_large_best.pt"
    KB_INDEX_PATH:    str = "knowledge_base/faiss_cbt.index"
    KB_META_PATH:     str = "knowledge_base/cbt_metadata.json"

    GROQ_API_KEY: str = ""

    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM:     str = ""
    MAIL_SERVER:   str = "smtp.gmail.com"
    MAIL_PORT:     int = 587
    FRONTEND_URL:  str = "http://localhost:3000"

    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def text_model_full_path(self) -> Path:
        return Path(__file__).resolve().parents[2] / self.TEXT_MODEL_PATH

    @property
    def audio_model_full_path(self) -> Path:
        return Path(__file__).resolve().parents[2] / self.AUDIO_MODEL_PATH

    @property
    def kb_index_full_path(self) -> Path:
        return Path(__file__).resolve().parents[2] / self.KB_INDEX_PATH

    @property
    def kb_meta_full_path(self) -> Path:
        return Path(__file__).resolve().parents[2] / self.KB_META_PATH


settings = Settings()