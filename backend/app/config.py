import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / 'data'
MODELS_DIR = DATA_DIR / 'models'
STORAGE_DIR = DATA_DIR / 'storage'

DATA_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    APP_NAME: str = 'FaceAttend AI'
    APP_ENV: str = 'development'
    DEBUG: bool = True
    HOST: str = '0.0.0.0'
    PORT: int = 8000
    FRONTEND_URL: str = 'http://localhost:5173'

    # Database Settings
    DB_BACKEND: str = 'postgres'  # 'postgres', 'mongodb', or 'fallback'
    POSTGRES_URL: Optional[str] = 'postgresql://postgres: tripathi@localhost:5432/faceattend_ai'
    POSTGRES_USER: str = 'postgres'
    POSTGRES_PASSWORD: str = ' tripathi'
    POSTGRES_HOST: str = 'localhost'
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = 'faceattend_ai'

    MONGODB_URI: str = 'mongodb://localhost:27017'
    MONGODB_DB_NAME: str = 'faceattend_ai'

    JWT_SECRET: str = 'faceattend_ai_super_secret_jwt_key_change_in_production_2026'
    JWT_ALGORITHM: str = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    DEFAULT_ADMIN_USERNAME: str = 'admin'
    DEFAULT_ADMIN_PASSWORD: str = 'admin123'
    DEFAULT_ADMIN_EMAIL: str = 'admin@faceattend.ai'

    RECOGNITION_THRESHOLD: float = 0.38
    MIN_FACE_CONFIDENCE: float = 0.75
    MIN_FACE_QUALITY: float = 0.60
    DETECTION_INPUT_SIZE: int = 320

    COOLDOWN_SECONDS: int = 10
    ALLOW_DUPLICATE_SAME_DAY: bool = False
    TIMEZONE: str = 'Asia/Kolkata'

    BASE_DIR: Path = BASE_DIR
    DATA_DIR: Path = DATA_DIR
    MODELS_DIR: Path = MODELS_DIR
    STORAGE_DIR: Path = STORAGE_DIR

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / '.env'),
        env_file_encoding='utf-8',
        extra='ignore'
    )

settings = Settings()
