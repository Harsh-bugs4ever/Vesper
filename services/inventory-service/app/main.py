from vesper_common.app_factory import create_app

from .api import purchase_router, router
from .events import start_subscriptions
from .jobs import build as build_scheduler


def _startup() -> None:
    start_subscriptions()
    build_scheduler().start()


app = create_app(
    name="inventory-service",
    title="Vesper Inventory",
    routers=(router, purchase_router),
    subscriptions=_startup,
)
