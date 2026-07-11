"""One-time verification codes (OTP) for email verification.

Codes are 6 digits, short-lived, and stored only as an HMAC hash so a
database leak never exposes usable codes. Brute force is contained by a
per-code attempt counter plus route-level rate limiting.
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from app.config import settings

OTP_LENGTH = 6
MAX_ATTEMPTS = 5


def generate_otp() -> str:
    """Return a cryptographically random 6-digit code (zero-padded)."""
    return f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"


def hash_otp(code: str) -> str:
    """HMAC the code with the server secret so stored hashes are unforgeable."""
    return hmac.new(
        settings.JWT_SECRET.encode(), code.encode(), hashlib.sha256
    ).hexdigest()


def otp_matches(code: str, code_hash: str) -> bool:
    return hmac.compare_digest(hash_otp(code), code_hash)


def new_otp_fields() -> tuple[str, dict]:
    """Generate a fresh code and the user-document fields that store it.

    Returns (plain_code, fields). The plain code is only ever sent by email.
    """
    code = generate_otp()
    fields = {
        "otp_hash": hash_otp(code),
        "otp_expires_at": datetime.now(timezone.utc)
        + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
        "otp_attempts": 0,
    }
    return code, fields
