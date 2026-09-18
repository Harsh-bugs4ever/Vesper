import asyncio

from vesper_common.app_factory import create_app

from .api import router, ws_router
from .events import bind_loop, start_subscriptions


def _start() -> None:
    # The bus consumer runs on a thread; it needs a handle on the app's event loop to
    # push anything to a WebSocket.
    bind_loop(asyncio.get_running_loop())
    start_subscriptions()


app = create_app(
    name="notification-service",
    title="Vesper Notifications",
    routers=(router, ws_router),
    subscriptions=_start,
)
