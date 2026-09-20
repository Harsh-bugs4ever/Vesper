"""Maintenance — sensor readings, anomaly detection and work orders.

The anomaly engine lives in .engines.anomaly.

Serves /maintenance.
"""
from .events import start_subscriptions
from .jobs import build as build_scheduler
from .router import router

NAME = "maintenance"
routers = (router,)

__all__ = ["NAME", "routers", "start_subscriptions", "build_scheduler"]
