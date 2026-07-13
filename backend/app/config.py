"""Application configuration via environment variables."""

from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings
from typing import Optional

# Resolve backend/.env relative to this file so the app works no matter
# which directory uvicorn is launched from.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

# Only ever used as the JWT_SECRET default in local dev. If this literal value
# is ever active with ENVIRONMENT=production, startup fails loudly instead of
# silently signing tokens with a public, guessable secret.
_INSECURE_DEFAULT_JWT_SECRET = "change-me-in-production-bloom-secret-key-2024"


class Settings(BaseSettings):
    # "development" (default, permissive) or "production" (enforces a real
    # JWT_SECRET). Render/production deploys should set ENVIRONMENT=production.
    ENVIRONMENT: str = "development"

    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "bloom"

    # JWT
    JWT_SECRET: str = _INSECURE_DEFAULT_JWT_SECRET
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
    OTP_EXPIRE_MINUTES: int = 10

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    # Extra allowed CORS origins beyond FRONTEND_URL, comma-separated
    # (e.g. a custom domain in addition to the default Vercel URL).
    CORS_ALLOWED_ORIGINS: str = ""

    model_config = {"env_file": str(_ENV_FILE), "env_file_encoding": "utf-8"}

    @model_validator(mode="after")
    def _require_real_secret_in_production(self) -> "Settings":
        if self.ENVIRONMENT == "production" and self.JWT_SECRET == _INSECURE_DEFAULT_JWT_SECRET:
            raise ValueError(
                "JWT_SECRET is still the insecure default. Set a real JWT_SECRET "
                "env var before running with ENVIRONMENT=production."
            )
        return self

    @property
    def cors_origins(self) -> list[str]:
        """FRONTEND_URL plus any extra origins from CORS_ALLOWED_ORIGINS."""
        origins = [self.FRONTEND_URL]
        origins += [o.strip() for o in self.CORS_ALLOWED_ORIGINS.split(",") if o.strip()]
        return list(dict.fromkeys(origins))  # de-dupe, preserve order


settings = Settings()
