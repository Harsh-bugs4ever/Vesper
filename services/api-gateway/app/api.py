"""The proxy itself.

One catch-all route. It authenticates, rate limits, forwards, and streams the answer
back. Hop-by-hop headers are dropped; everything else passes through untouched so a
service's own status codes and error bodies reach the browser intact.
"""
from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Request, Response, WebSocket
from fastapi.responses import JSONResponse

from vesper_common.config import settings
from vesper_common.security import decode_token, principal_from_payload

from .service import limiter, resolve

log = logging.getLogger(__name__)

router = APIRouter()

# Long enough for a CP-SAT roster solve or a concierge round trip, short enough that a
# wedged upstream does not pin a browser tab open indefinitely.
TIMEOUT = httpx.Timeout(45.0, connect=5.0)

# Set per-connection by the proxy or the server; forwarding them corrupts the response.
HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-length",
    "content-encoding",
    "host",
}

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    """One pooled client for the process — a new connection per request would cap us."""
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=False)
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def _error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code, content={"error": {"code": code, "message": message}})


@router.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy(full_path: str, request: Request) -> Response:
    path = "/" + full_path.lstrip("/")
    route = resolve(path)
    if route is None:
        return _error(404, "no_route", f"Nothing is mounted at {path}")

    identity, kind = "anonymous", "anonymous"
    header = request.headers.get("authorization", "")
    token = header.removeprefix("Bearer ").strip() if header.startswith("Bearer ") else ""

    if token:
        # Validated here so a bad token is rejected once, at the edge, rather than
        # thirteen times downstream.
        try:
            principal = principal_from_payload(decode_token(token))
        except Exception:
            return _error(401, "invalid_token", "Your session is not valid")
        identity = principal.id
        kind = "guest" if principal.is_guest else "staff"
    elif route.requires_auth:
        return _error(401, "not_authenticated", "This endpoint needs a token")
    else:
        # Unauthenticated calls are limited by source address, not by identity.
        identity = request.client.host if request.client else "unknown"

    allowed, remaining, reset_in = limiter.check(identity, kind)
    if not allowed:
        response = _error(429, "rate_limited", "Too many requests — slow down a moment")
        response.headers["retry-after"] = str(reset_in)
        return response

    forwarded = {
        key: value for key, value in request.headers.items() if key.lower() not in HOP_BY_HOP
    }
    body = await request.body()

    try:
        upstream = await get_client().request(
            request.method,
            f"{route.upstream}{path}",
            headers=forwarded,
            params=dict(request.query_params),
            content=body or None,
        )
    except httpx.TimeoutException:
        log.warning("timeout proxying %s to %s", path, route.upstream)
        return _error(504, "upstream_timeout", "That service took too long to answer")
    except httpx.HTTPError:
        log.warning("could not reach %s for %s", route.upstream, path, exc_info=True)
        return _error(503, "upstream_unavailable", "That service is unavailable right now")

    passthrough = {
        key: value for key, value in upstream.headers.items() if key.lower() not in HOP_BY_HOP
    }
    passthrough["x-ratelimit-remaining"] = str(remaining)
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=passthrough,
        media_type=upstream.headers.get("content-type"),
    )


@router.websocket("/live")
async def live(websocket: WebSocket) -> None:
    """Bridge the live feed through to notification-service.

    The token rides in the query string (browsers cannot set headers on a WebSocket
    handshake) and is validated by notification-service, which owns the hub.
    """
    import websockets

    token = websocket.query_params.get("token", "")
    if not token:
        await websocket.close(code=1008)
        return

    upstream_url = settings.notification_url.replace("http://", "ws://").replace(
        "https://", "wss://"
    )
    await websocket.accept()
    try:
        async with websockets.connect(f"{upstream_url}/live?token={token}") as upstream:
            import asyncio

            async def to_upstream() -> None:
                while True:
                    await upstream.send(await websocket.receive_text())

            async def to_client() -> None:
                async for message in upstream:
                    await websocket.send_text(message)

            done, pending = await asyncio.wait(
                [asyncio.create_task(to_upstream()), asyncio.create_task(to_client())],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
    except Exception:
        log.info("live socket closed", exc_info=True)
    finally:
        try:
            await websocket.close()
        except RuntimeError:
            pass  # already closed by the client
