"""Shared origin allow-list logic for CORS and the WebSocket handshake.

Keeping one source of truth means the WebSocket endpoint (which Starlette
does not CORS-protect automatically) enforces the same origin policy as
regular HTTP requests.
"""

import re

from app.config import settings

# Local dev: any localhost port (Vite may pick a different one) and any
# Vercel preview deployment subdomain (each PR/branch gets a unique URL).
_DEV_AND_PREVIEW_ORIGIN_REGEX = re.compile(
    r"^(http://localhost:\d+|https://[a-zA-Z0-9-]+\.vercel\.app)$"
)


def is_allowed_origin(origin: str | None) -> bool:
    """Check an Origin header against the configured allow-list."""
    if not origin:
        return False
    if origin in settings.cors_origins:
        return True
    return bool(_DEV_AND_PREVIEW_ORIGIN_REGEX.match(origin))


# Exposed for CORSMiddleware's allow_origin_regex (same policy, regex form).
CORS_ORIGIN_REGEX = _DEV_AND_PREVIEW_ORIGIN_REGEX.pattern
