"""Action queue — the decision layer.

Every engine's suggestion becomes a card here: drivers, a rupee impact, an urgency
and whoever may approve it. The AI engines call into this module rather than the
other way round.

Serves /cards, /dashboard, /learning and /audit.
"""
from .events import start_subscriptions
from .jobs import build as build_scheduler
from .router import audit_router, dashboard_router, learning_router, router

NAME = "action"
routers = (router, learning_router, audit_router, dashboard_router)

__all__ = ["NAME", "routers", "start_subscriptions", "build_scheduler"]
