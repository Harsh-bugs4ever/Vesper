"""Workforce — rostering.

The CP-SAT roster solver lives in .engines.roster.

Serves /workforce.
"""
from .events import start_subscriptions
from .router import router

NAME = "workforce"
routers = (router,)

__all__ = ["NAME", "routers", "start_subscriptions"]
