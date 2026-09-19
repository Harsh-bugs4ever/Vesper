from vesper_common.app_factory import create_app

from .api import admin_router, auth_router
from .events import start_subscriptions
from .jobs import build as build_scheduler


def _startup() -> None:
    start_subscriptions()
    build_scheduler().start()


app = create_app(
    name="identity-service",
    title="Vesper Identity",
    routers=(auth_router, admin_router),
    subscriptions=_startup,
)
