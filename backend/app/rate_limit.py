"""Shared slowapi rate limiter.

Keyed by client IP. Individual routes opt in with the ``@limiter.limit(...)``
decorator (they must accept a ``request: Request`` parameter for slowapi to
find the client address).
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
