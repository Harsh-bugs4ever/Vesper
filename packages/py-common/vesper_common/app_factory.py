"""One FastAPI app builder, so all thirteen services behave the same.

Gives every service: CORS, the shared error shape, /health and /ready, request-id
logging, and an optional event subscription started at boot.
"""
import logging
import sys
from collections.abc import Awaitable, Callable, Iterable
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .clock import utcnow
from .config import settings
from .db import get_engine
from .errors import install_error_handlers
from .events import Envelope, bus


def configure_logging(service: str) -> None:
    """Make the service's own log output actually appear.

    uvicorn configures handlers for its own loggers only. Without this, every
    `log.info` in our code propagates to a bare root logger, finds no handler, and is
    dropped — so a scheduled job could run all day and leave no trace. That is a bad
    way to find out what the backend has been doing.

    Called once per process; a second call is a no-op rather than a duplicated handler.
    """
    root = logging.getLogger()
    if any(getattr(h, "_vesper", False) for h in root.handlers):
        return

    handler = logging.StreamHandler(sys.stdout)
    handler._vesper = True  # type: ignore[attr-defined]
    handler.setFormatter(
        logging.Formatter(
            f"%(asctime)s %(levelname)-7s [{service}] %(name)s: %(message)s",
            datefmt="%H:%M:%S",
        )
    )
    root.addHandler(handler)
    root.setLevel(logging.DEBUG if settings.debug else logging.INFO)

    # These two are chatty and uvicorn already reports what matters from them.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def create_app(
    *,
    name: str,
    title: str,
    version: str = "0.1.0",
    routers: Iterable[APIRouter] = (),
    subscriptions: Callable[[], None] | None = None,
    on_shutdown: Callable[[], Awaitable[None]] | None = None,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if subscriptions is not None:
            subscriptions()
        yield
        if on_shutdown is not None:
            await on_shutdown()

    configure_logging(name)

    app = FastAPI(
        title=title,
        version=version,
        docs_url="/docs",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )
    app.state.service_name = name

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid4().hex
        response = await call_next(request)
        response.headers["x-request-id"] = rid
        return response

    @app.get("/health", tags=["system"])
    def health() -> dict:
        return {"service": name, "status": "ok", "time": utcnow().isoformat()}

    @app.get("/ready", tags=["system"])
    def ready() -> dict:
        checks = {"database": False, "redis": False}
        try:
            with get_engine().connect() as conn:
                conn.execute(text("SELECT 1"))
            checks["database"] = True
        except Exception:  # noqa: BLE001 - readiness must not raise
            pass
        try:
            checks["redis"] = bool(bus.client.ping())
        except Exception:  # noqa: BLE001
            pass
        return {"service": name, "ready": all(checks.values()), "checks": checks}

    for router in routers:
        app.include_router(router)

    return app


def on_events(group: str, names: set[str]):
    """Decorator form of bus.subscribe, used in each service's events.py."""

    def wrapper(handler: Callable[[Envelope], None]) -> Callable[[], None]:
        def start() -> None:
            bus.subscribe(handler, group=group, names=names)

        return start

    return wrapper
