"""Guest — QR sessions, requests, issues and the guest directory.

UPLOAD_DIR is re-exported because the entry point mounts it as a static
directory: issue photos are served straight back off the volume they land on.

Serves /guest, /requests, /issues and /guests.
"""
from .events import start_subscriptions
from .jobs import build as build_scheduler
from .router import UPLOAD_DIR, guest_router, guests_router, issues_router, requests_router
from .support_router import guest_router as support_guest_router, staff_router as support_staff_router

NAME = "guest"
routers = (guest_router, requests_router, issues_router, guests_router, support_guest_router, support_staff_router)

__all__ = ["NAME", "routers", "start_subscriptions", "build_scheduler", "UPLOAD_DIR"]
