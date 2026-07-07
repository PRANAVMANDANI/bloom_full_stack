"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "bloom"

    # JWT
    JWT_SECRET: str = "change-me-in-production-bloom-secret-key-2024"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Groq LLM
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Google OAuth (Web application client ID). Empty disables Google sign-in.
    GOOGLE_CLIENT_ID: str = ""

    # Email via Brevo's HTTP API (not SMTP — cloud hosts often block outbound
    # SMTP ports entirely, while a plain HTTPS call always works). Empty
    # BREVO_API_KEY falls back to logging the link to the console (dev mode).
    BREVO_API_KEY: str = ""
    FROM_EMAIL: str = ""
    FROM_NAME: str = "BLOOM"
    EMAIL_VERIFICATION_EXPIRE_HOURS: int = 24

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    # Extra allowed CORS origins beyond FRONTEND_URL, comma-separated
    # (e.g. a custom domain in addition to the default Vercel URL).
    CORS_ALLOWED_ORIGINS: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origins(self) -> list[str]:
        """FRONTEND_URL plus any extra origins from CORS_ALLOWED_ORIGINS."""
        origins = [self.FRONTEND_URL]
        origins += [o.strip() for o in self.CORS_ALLOWED_ORIGINS.split(",") if o.strip()]
        return list(dict.fromkeys(origins))  # de-dupe, preserve order


settings = Settings()
