"""Front desk — bookings, stays and visits.

Serves /bookings, /stays and /visits.
"""
from .events import start_subscriptions
from .router import bookings_router, stays_router, visits_router

NAME = "frontdesk"
routers = (bookings_router, stays_router, visits_router)

__all__ = ["NAME", "routers", "start_subscriptions"]
