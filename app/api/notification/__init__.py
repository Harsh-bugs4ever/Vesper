"""Notifications — the outbox and the live WebSocket feed.

bind_loop is re-exported because the entry point must hand the bus consumer a
handle on the running event loop before any subscription starts; without it a
thread-side event has no way to reach a socket.

Serves /notifications and the /live WebSocket.
"""
from .events import bind_loop, start_subscriptions
from .jobs import build as build_scheduler
from .router import router, ws_router

NAME = "notification"
routers = (router, ws_router)

__all__ = ["NAME", "routers", "start_subscriptions", "build_scheduler", "bind_loop"]
