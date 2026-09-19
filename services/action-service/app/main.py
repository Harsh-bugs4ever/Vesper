from vesper_common.app_factory import create_app

from .api import audit_router, dashboard_router, learning_router, router
from .events import start_subscriptions
from .jobs import build as build_scheduler


def _startup() -> None:
    start_subscriptions()
    build_scheduler().start()


app = create_app(
    name="action-service",
    title="Vesper Action Queue",
    routers=(router, learning_router, audit_router, dashboard_router),
    subscriptions=_startup,
)
