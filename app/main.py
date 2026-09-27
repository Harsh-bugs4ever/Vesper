"""The one process.

Thirteen containers became one: the same routers, mounted on the same paths, in
front of the same database and the same Redis. A browser cannot tell the
difference — `/auth/login` is still `/auth/login`, and every response model kept
its name — but there is no longer a proxy hop, a service socket or twelve extra
images between a request and the code that answers it.

What used to be one `create_app` per service is now one call with every module's
routers. The startup sequence below is the part that genuinely changed:

  1. The event loop is handed to notification, whose bus consumer runs on a thread
     and needs a way to push an event onto a WebSocket.
  2. Internal calls are pointed in-process, so `clients.frontdesk.get(...)` reaches
     the front desk routes through the ASGI app instead of a socket.
  3. The worker thread pool is widened, because those calls now nest: a handler on
     a worker thread waits on another handler, which needs a thread of its own.
  4. The Redis consumers start, then the scheduled jobs.

Run it with:

    uvicorn app.main:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import asyncio
import logging

import anyio.to_thread
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from vesper_common.app_factory import create_app
from vesper_common.config import settings

from app import __version__
from app.api import MODULES
from app.api.guest import UPLOAD_DIR
from app.api.notification import bind_loop
from app.background import ai_workers, event_bus
from app.rate_limit import RateLimitMiddleware
from app import transport

log = logging.getLogger(__name__)

# Handlers are synchronous, so FastAPI runs each on a worker thread — and an internal
# call made from one occupies its thread while a second handler runs on another. The
# default ceiling of 40 is comfortable for a resort's traffic but leaves no room for
# that nesting under load, and running out of threads looks like the server hanging
# rather than like an error.
THREAD_POOL_SIZE = 160


def _routers():
    for module in MODULES:
        yield from module.routers


async def _shutdown() -> None:
    await ai_workers.stop()


def _startup() -> None:
    """Run inside the lifespan hook, with the event loop already running."""
    loop = asyncio.get_running_loop()
    anyio.to_thread.current_default_thread_limiter().total_tokens = THREAD_POOL_SIZE

    bind_loop(loop)
    transport.install(app, loop)

    event_bus.start()
    ai_workers.start()

    routes = sum(1 for r in app.routes if getattr(r, "methods", None))
    log.info(
        "Vesper %s up: %s modules, %s routes, one process",
        __version__,
        len(MODULES),
        routes,
    )


app = create_app(
    name=settings.service_name,
    title="Vesper API",
    version=__version__,
    routers=tuple(_routers()),
    subscriptions=_startup,
    on_shutdown=_shutdown,
)

# Compresses payloads > 1KB (reduces JSON payload transfer times by 70-85%).
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Added last, so it wraps everything else: a caller over their limit is turned away
# before a handler, a database session or an event is spent on them.
app.add_middleware(RateLimitMiddleware)

# Issue photos are served straight back off the volume they were written to.
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
