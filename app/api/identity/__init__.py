"""Identity — users, roles, permissions, tokens.

Owns the permission matrix. Every other module imports it from here rather than
holding a copy, so there is exactly one place a role's rights are defined.

Serves /auth and /admin.
"""
from .events import start_subscriptions
from .jobs import build as build_scheduler
from .router import admin_router, auth_router

NAME = "identity"
routers = (auth_router, admin_router)

__all__ = ["NAME", "routers", "start_subscriptions", "build_scheduler"]
