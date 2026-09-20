"""Inventory — stock on hand, movements and purchase orders.

Serves /inventory and /purchase-orders.
"""
from .events import start_subscriptions
from .jobs import build as build_scheduler
from .router import purchase_router, router

NAME = "inventory"
routers = (router, purchase_router)

__all__ = ["NAME", "routers", "start_subscriptions", "build_scheduler"]
