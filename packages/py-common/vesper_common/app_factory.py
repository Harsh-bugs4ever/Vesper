"""One FastAPI app builder, so all thirteen services behave the same.

Gives every service: CORS, the shared error shape, /health and /ready, request-id
logging, and an optional event subscription started at boot.
"""
from collections.abc import Callable, Iterable
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .clock import utcnow
from .config import settings
from .db import engine
from .errors import install_error_handlers
from .events import Envelope, bus


def create_app(
    *,
    name: str,
    title: str,
    version: str = "0.1.0",
    routers: Iterable[APIRouter] = (),
    subscriptions: Callable[[], None] | None = None,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if subscriptions is not None:
            subscriptions()
        yield

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
            with engine.connect() as conn:
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
