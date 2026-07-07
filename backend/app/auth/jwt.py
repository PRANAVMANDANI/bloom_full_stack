"""JWT token creation and verification."""

from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from app.config import settings


def create_email_verification_token(user_id: str) -> str:
    """Create a short-lived signed token used to verify an email address."""
    expire = datetime.now(timezone.utc) + timedelta(
        hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS
    )
    to_encode = {"sub": user_id, "exp": expire, "type": "verify"}
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(data: dict) -> str:
    """Create a short-lived access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a long-lived refresh token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str, token_type: str = "access") -> dict | None:
    """Verify and decode a JWT token. Returns payload or None."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != token_type:
            return None
        return payload
    except JWTError:
        return None


def create_token_pair(user: dict) -> tuple[str, str]:
    """Issue a fresh (access, refresh) pair for a user document.

    The token carries a ``token_version`` that must match the user's current
    version. Bumping ``users.token_version`` (on logout or password change)
    invalidates every previously issued token for that user.
    """
    token_data = {
        "sub": str(user["_id"]),
        "email": user["email"],
        "token_version": user.get("token_version", 0),
    }
    return create_access_token(token_data), create_refresh_token(token_data)
