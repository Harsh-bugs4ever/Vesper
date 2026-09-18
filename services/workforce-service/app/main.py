from vesper_common.app_factory import create_app

from .api import router
from .events import start_subscriptions

app = create_app(
    name="workforce-service",
    title="Vesper Workforce",
    routers=(router,),
    subscriptions=start_subscriptions,
)
