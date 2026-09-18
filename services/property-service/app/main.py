from vesper_common.app_factory import create_app

from .api import assets_router, rooms_router, router
from .events import start_subscriptions

app = create_app(
    name="property-service",
    title="Vesper Property",
    routers=(router, rooms_router, assets_router),
    subscriptions=start_subscriptions,
)
