from vesper_common.app_factory import create_app

from .api import purchase_router, router
from .events import start_subscriptions

app = create_app(
    name="inventory-service",
    title="Vesper Inventory",
    routers=(router, purchase_router),
    subscriptions=start_subscriptions,
)
