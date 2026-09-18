from vesper_common.app_factory import create_app

from .api import router
from .events import start_subscriptions

app = create_app(
    name="revenue-service",
    title="Vesper Revenue",
    routers=(router,),
    subscriptions=start_subscriptions,
)
