from vesper_common.app_factory import create_app

from .api import router
from .events import start_subscriptions

app = create_app(
    name="maintenance-service",
    title="Vesper Maintenance",
    routers=(router,),
    subscriptions=start_subscriptions,
)
