from vesper_common.app_factory import create_app

from .api import attendance_router, tasks_router
from .events import start_subscriptions

app = create_app(
    name="staff-service",
    title="Vesper Staff",
    routers=(attendance_router, tasks_router),
    subscriptions=start_subscriptions,
)
