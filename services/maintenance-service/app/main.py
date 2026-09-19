from vesper_common.app_factory import create_app

from .api import router
from .events import start_subscriptions
from .jobs import build as build_scheduler


def _startup() -> None:
    start_subscriptions()
    build_scheduler().start()


app = create_app(
    name="maintenance-service",
    title="Vesper Maintenance",
    routers=(router,),
    subscriptions=_startup,
)
