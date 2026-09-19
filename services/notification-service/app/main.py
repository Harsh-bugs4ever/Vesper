import asyncio

from vesper_common.app_factory import create_app

from .api import router, ws_router
from .events import bind_loop, start_subscriptions
from .jobs import build as build_scheduler


def _start() -> None:
    # The bus consumer runs on a thread; it needs a handle on the app's event loop to
    # push anything to a WebSocket.
    bind_loop(asyncio.get_running_loop())
    start_subscriptions()
    # Without this the outbox is a list of things that failed once and are never retried.
    build_scheduler().start()


app = create_app(
    name="notification-service",
    title="Vesper Notifications",
    routers=(router, ws_router),
    subscriptions=_start,
)
