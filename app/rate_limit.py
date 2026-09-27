"""Per-principal rate limiting.

This is the gateway's limiter, unchanged in behaviour and moved inward. With no
proxy in front of the app any more, it runs as middleware on the one process every
browser request now reaches.

The routing table that used to live beside it is gone: there is nothing left to
route to. Authentication is not done here either — each endpoint already declares
what it needs through `current_user` and `requires`, so an unauthenticated call is
rejected by the route that owns it rather than by a table that has to be kept in
step with one.
"""
from __future__ import annotations

import logging
import time

import redis
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from vesper_common.config import settings
from vesper_common.security import decode_token, principal_from_payload

log = logging.getLogger(__name__)

# Per-principal request ceilings per minute. Guests are held tighter than staff: a QR
# page is reachable by anyone holding a phone in a room.
RATE_LIMITS = {"guest": 120, "staff": 600, "anonymous": 30}
WINDOW_SECONDS = 60

# Health checks and the docs are polled by container orchestration and by whoever is
# demoing; counting them against a limit only produces confusing 429s.
EXEMPT_PATHS = frozenset({"/health", "/ready", "/docs", "/redoc", "/openapi.json"})


class RateLimiter:
    """Fixed-window counter with Redis primary and ultra-fast in-memory fallback.

    If Redis is unreachable or slow, the circuit breaker opens instantly, failing over to
    an in-memory window counter. This completely prevents 4+ second socket timeouts from
    blocking requests.
    """

    def __init__(self, url: str | None = None) -> None:
        self._client: redis.Redis | None = None
        self._url = url or settings.redis_url
        self._circuit_open_until = 0.0
        self._memory_counts: dict[str, int] = {}
        self._memory_window: int = 0

    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            self._client = redis.Redis.from_url(
                self._url,
                decode_responses=True,
                socket_connect_timeout=0.05,
                socket_timeout=0.1,
                retry_on_timeout=False,
            )
        return self._client

    def check(self, identity: str, kind: str) -> tuple[bool, int, int]:
        """Returns (allowed, remaining, seconds_until_reset)."""
        limit = RATE_LIMITS.get(kind, RATE_LIMITS["anonymous"])
        now = time.time()
        window = int(now) // WINDOW_SECONDS
        reset_in = WINDOW_SECONDS - (int(now) % WINDOW_SECONDS)

        # Fast in-memory path when circuit breaker is active
        if time.monotonic() < self._circuit_open_until:
            return self._check_memory(identity, kind, limit, window, reset_in)

        key = f"vesper:ratelimit:{kind}:{identity}:{window}"
        try:
            pipe = self.client.pipeline()
            pipe.incr(key)
            pipe.expire(key, WINDOW_SECONDS * 2)
            count = pipe.execute()[0]
            return count <= limit, max(0, limit - count), reset_in
        except (redis.RedisError, OSError, TimeoutError):
            # Trip circuit breaker for 300s so subsequent requests don't block
            self._circuit_open_until = time.monotonic() + 300.0
            log.warning("rate limiter redis unavailable; failing over to in-memory rate limiting")
            self._client = None
            return self._check_memory(identity, kind, limit, window, reset_in)

    def _check_memory(self, identity: str, kind: str, limit: int, window: int, reset_in: int) -> tuple[bool, int, int]:
        if window != self._memory_window:
            self._memory_counts.clear()
            self._memory_window = window
        key = f"{kind}:{identity}"
        count = self._memory_counts.get(key, 0) + 1
        self._memory_counts[key] = count
        return count <= limit, max(0, limit - count), reset_in


limiter = RateLimiter()



class RateLimitMiddleware(BaseHTTPMiddleware):
    """Count each request against whoever made it, before it reaches a handler."""

    async def dispatch(self, request, call_next):
        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        identity, kind = "anonymous", "anonymous"
        header = request.headers.get("authorization", "")
        token = header.removeprefix("Bearer ").strip() if header.startswith("Bearer ") else ""

        if token:
            try:
                principal = principal_from_payload(decode_token(token))
            except Exception:
                # Not this layer's call to reject it: the route's own dependency
                # produces the proper 401, with the error shape the frontend expects.
                # Limit it as an anonymous caller in the meantime.
                principal = None
            if principal is not None:
                if principal.role == "service":
                    # An internal call is the tail of a browser request that was
                    # already counted at the edge. Counting it again would let one
                    # guest action consume several of their own allowance.
                    return await call_next(request)
                identity = principal.id
                kind = "guest" if principal.is_guest else "staff"

        if kind == "anonymous":
            identity = request.client.host if request.client else "unknown"

        allowed, remaining, reset_in = limiter.check(identity, kind)
        if not allowed:
            response = JSONResponse(
                content={"error": {"code": "rate_limited", "message": "Too many requests — slow down a moment"}},
                status_code=429,
            )
            response.headers["retry-after"] = str(reset_in)
            return response

        response = await call_next(request)
        response.headers["x-ratelimit-remaining"] = str(remaining)
        return response
