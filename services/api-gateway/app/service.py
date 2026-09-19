"""Routing table and rate limiting.

The gateway is the only thing the three frontends talk to. It validates the token once,
decides which service owns the path, and proxies. It deliberately holds no business
logic and no database — everything it knows is in the table below.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import redis

from vesper_common.config import settings

log = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class Route:
    prefix: str
    upstream: str
    # False for the handful of endpoints a guest reaches before they have any token.
    requires_auth: bool = True


# Longest prefix wins, so ordering here is by specificity, not alphabet.
ROUTES: tuple[Route, ...] = (
    Route("/auth", settings.identity_url, requires_auth=False),
    Route("/admin", settings.identity_url),
    Route("/property", settings.property_url),
    Route("/rooms", settings.property_url),
    Route("/assets", settings.property_url),
    Route("/attendance", settings.staff_url),
    Route("/tasks", settings.staff_url),
    # Opening a QR session is the one guest call made without a token.
    Route("/guest/session", settings.guest_url, requires_auth=False),
    Route("/guest", settings.guest_url),
    Route("/requests", settings.guest_url),
    Route("/issues", settings.guest_url),
    Route("/guests", settings.guest_url),
    Route("/uploads", settings.guest_url, requires_auth=False),
    Route("/inventory", settings.inventory_url),
    Route("/purchase-orders", settings.inventory_url),
    Route("/bookings", settings.frontdesk_url),
    Route("/stays", settings.frontdesk_url),
    Route("/visits", settings.frontdesk_url),
    Route("/cards", settings.action_url),
    Route("/dashboard", settings.action_url),
    Route("/learning", settings.action_url),
    Route("/audit", settings.action_url),
    Route("/revenue", settings.revenue_url),
    Route("/maintenance", settings.maintenance_url),
    Route("/workforce", settings.workforce_url),
    Route("/guest-intel", settings.guest_intel_url),
    Route("/guest-reviews", settings.guest_intel_url),
    Route("/notifications", settings.notification_url),
)

# Per-principal request ceilings per minute. Guests are held tighter than staff: a QR
# page is reachable by anyone holding a phone in a room.
RATE_LIMITS = {"guest": 120, "staff": 600, "anonymous": 30}
WINDOW_SECONDS = 60


def resolve(path: str) -> Route | None:
    """Longest matching prefix, so /guest/session beats /guest."""
    best: Route | None = None
    for route in ROUTES:
        if path == route.prefix or path.startswith(route.prefix + "/"):
            if best is None or len(route.prefix) > len(best.prefix):
                best = route
    return best


class RateLimiter:
    """Fixed-window counter in Redis.

    Fixed rather than sliding on purpose: it is one INCR per request, it survives a
    restart, and it is shared across gateway replicas. A burst at a window boundary is
    an acceptable trade for a demo-scale service.

    If Redis is unreachable the limiter fails open — a rate limiter outage must not
    take the whole product down.
    """

    def __init__(self, url: str | None = None) -> None:
        self._client: redis.Redis | None = None
        self._url = url or settings.redis_url

    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            self._client = redis.Redis.from_url(self._url, decode_responses=True)
        return self._client

    def check(self, identity: str, kind: str) -> tuple[bool, int, int]:
        """Returns (allowed, remaining, seconds_until_reset)."""
        limit = RATE_LIMITS.get(kind, RATE_LIMITS["anonymous"])
        window = int(time.time()) // WINDOW_SECONDS
        key = f"vesper:ratelimit:{kind}:{identity}:{window}"
        try:
            pipe = self.client.pipeline()
            pipe.incr(key)
            pipe.expire(key, WINDOW_SECONDS * 2)
            count = pipe.execute()[0]
        except redis.RedisError:
            log.warning("rate limiter unavailable; allowing the request", exc_info=True)
            return True, limit, WINDOW_SECONDS

        reset_in = WINDOW_SECONDS - (int(time.time()) % WINDOW_SECONDS)
        return count <= limit, max(0, limit - count), reset_in


limiter = RateLimiter()
