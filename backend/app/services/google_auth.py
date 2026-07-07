"""Verify Google Sign-In ID tokens (Google Identity Services credential)."""

from fastapi.concurrency import run_in_threadpool
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.config import settings

_ALLOWED_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


class GoogleAuthError(Exception):
    """Raised when a Google credential cannot be verified."""


async def verify_google_credential(credential: str) -> dict:
    """Verify a Google ID token and return normalized profile fields.

    Returns a dict with: sub, email, email_verified, name, picture.
    Raises GoogleAuthError on any verification failure.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleAuthError("Google sign-in is not configured on the server.")

    def _verify() -> dict:
        # id_token.verify_oauth2_token performs signature, audience and
        # expiry checks. It does blocking network I/O to fetch Google's certs,
        # so we run it off the event loop.
        return id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )

    try:
        idinfo = await run_in_threadpool(_verify)
    except ValueError as e:
        raise GoogleAuthError(f"Invalid Google credential: {e}") from e

    if idinfo.get("iss") not in _ALLOWED_ISSUERS:
        raise GoogleAuthError("Untrusted token issuer.")

    if not idinfo.get("email"):
        raise GoogleAuthError("Google account has no email.")

    return {
        "sub": idinfo["sub"],
        "email": idinfo["email"].lower(),
        "email_verified": bool(idinfo.get("email_verified")),
        "name": idinfo.get("name") or idinfo["email"].split("@")[0],
        "picture": idinfo.get("picture"),
    }
