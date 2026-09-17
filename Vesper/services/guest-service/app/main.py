from fastapi.staticfiles import StaticFiles

from vesper_common.app_factory import create_app

from .api import UPLOAD_DIR, guest_router, guests_router, issues_router, requests_router
from .events import start_subscriptions

app = create_app(
    name="guest-service",
    title="Vesper Guest",
    routers=(guest_router, requests_router, issues_router, guests_router),
    subscriptions=start_subscriptions,
)

# Issue photos are served straight back off the mounted volume they were written to.
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
