"""Staff — attendance and the task board.

Serves /attendance and /tasks.
"""
from .events import start_subscriptions
from .jobs import build as build_scheduler
from .router import attendance_router, tasks_router, reports_router, performance_router

NAME = "staff"
routers = (attendance_router, tasks_router, reports_router, performance_router)

__all__ = ["NAME", "routers", "start_subscriptions", "build_scheduler"]
