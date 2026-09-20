"""Staff — attendance and the task board.

Serves /attendance and /tasks.
"""
from .events import start_subscriptions
from .router import attendance_router, tasks_router

NAME = "staff"
routers = (attendance_router, tasks_router)

__all__ = ["NAME", "routers", "start_subscriptions"]
