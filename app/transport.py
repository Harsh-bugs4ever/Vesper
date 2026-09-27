"""Service-to-service calls without a socket.

In the micro-service deployment, `clients.frontdesk.get("/stays/...")` was a real
HTTP request to another container. In the monolith the callee is in this process,
so the request is handed straight to the ASGI app instead.

Two things make that harder than it sounds:

  * **The callers are synchronous.** Almost every handler in the codebase is a
    plain `def`, which FastAPI runs on a worker thread; so are the scheduler jobs
    and the bus consumers. httpx only speaks ASGI asynchronously, so each call is
    submitted to the app's event loop and waited on from the calling thread.
  * **A call must not re-enter the loop thread.** Submitting from the loop thread
    and blocking on the result would deadlock the whole process, so that is
    refused loudly rather than hanging. Nothing in the codebase does it today —
    the only `async def` endpoints are the photo upload and the WebSocket, and
    neither calls a peer — but a future one would find out at once instead of
    wedging the server.

Middleware and dependencies still run exactly as they would over the network, so
a service token is still validated and a 404 is still a 404.
"""
from __future__ import annotations

import asyncio
import logging

import httpx

log = logging.getLogger(__name__)

# Generous: it bounds a call this process makes to itself, and a CP-SAT roster
# solve behind one of these is genuinely slow. Short enough that a wedged handler
# surfaces as an error rather than a hung request.
CALL_TIMEOUT_SECONDS = 60.0

# Requests are dispatched in-process, so the host in the URL is never resolved.
# It still has to be a valid absolute URL for httpx to build the request.
INTERNAL_BASE_URL = "http://vesper.internal"


class InProcessTransport(httpx.BaseTransport):
    """A synchronous httpx transport that dispatches into an ASGI app."""

    def __init__(self, app, loop: asyncio.AbstractEventLoop) -> None:
        # raise_app_exceptions=False so an unhandled error downstream comes back as
        # a 500 response, which is what ServiceClient's callers already handle.
        self._asgi = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        self._loop = loop

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is self._loop:
            raise RuntimeError(
                f"{request.method} {request.url.path} was called from the event loop. "
                "An internal call blocks the calling thread, so making one from an "
                "async handler would deadlock the process; call it from a sync "
                "handler, or await the underlying function directly."
            )

        request.read()  # the body has to be in hand before it crosses threads
        future = asyncio.run_coroutine_threadsafe(self._dispatch(request), self._loop)
        return future.result(timeout=CALL_TIMEOUT_SECONDS)

    async def _dispatch(self, request: httpx.Request) -> httpx.Response:
        # In-process internal calls stay in memory; bypass GZip compression to avoid decompression conflicts
        request.headers["accept-encoding"] = "identity"
        response = await self._asgi.handle_async_request(request)
        try:
            body = await response.aread()
        finally:
            await response.aclose()
        # Rebuilt around the bytes we just read: the response handed back by
        # ASGITransport carries an async stream, and the caller is a sync client
        # that would try to iterate it synchronously.
        return httpx.Response(
            status_code=response.status_code,
            headers=response.headers,
            content=body,
            request=request,
        )


def install(app, loop: asyncio.AbstractEventLoop) -> None:
    """Point every ServiceClient at this app. Called once, at startup."""
    from vesper_common import clients

    for client in clients._registry:
        client.base_url = INTERNAL_BASE_URL
    clients.use_transport(InProcessTransport(app, loop))
    log.info("internal calls are dispatched in-process; no service sockets are opened")


def uninstall() -> None:
    """Undo install(), so a test can fall back to ordinary transports."""
    from vesper_common import clients

    clients.use_transport(None)
