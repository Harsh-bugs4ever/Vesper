"""Property — the resort itself: buildings, rooms, assets.

Serves /property, /rooms and /assets.
"""
from .events import start_subscriptions
from .router import assets_router, rooms_router, router

NAME = "property"
routers = (router, rooms_router, assets_router)

__all__ = ["NAME", "routers", "start_subscriptions"]
