from vesper_common.app_factory import create_app

from .api import bookings_router, stays_router, visits_router
from .events import start_subscriptions

app = create_app(
    name="frontdesk-service",
    title="Vesper Front Desk",
    routers=(bookings_router, stays_router, visits_router),
    subscriptions=start_subscriptions,
)
