"""Revenue — demand forecasting and rate suggestions.

The demand engine lives in .engines.demand and is importable from any handler.

Serves /revenue.
"""
from .events import start_subscriptions
from .jobs import build as build_scheduler
from .router import router

NAME = "revenue"
routers = (router,)

__all__ = ["NAME", "routers", "start_subscriptions", "build_scheduler"]
