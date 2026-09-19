from vesper_common.app_factory import create_app

from .api import router
from .reviews_api import router as reviews_router
from .events import start_subscriptions
from .jobs import build as build_scheduler


def _startup() -> None:
    start_subscriptions()
    build_scheduler().start()


app = create_app(
    name="guest-intel-service",
    title="Vesper Guest Intelligence",
    routers=(router, reviews_router),
    subscriptions=_startup,
)
