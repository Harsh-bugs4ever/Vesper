from vesper_common.app_factory import create_app

from .api import audit_router, learning_router, router
from .events import start_subscriptions

app = create_app(
    name="action-service",
    title="Vesper Action Queue",
    routers=(router, learning_router, audit_router),
    subscriptions=start_subscriptions,
)
