"""Shared building blocks for every Vesper service."""
from .app_factory import create_app, on_events
from .clock import local_today, to_local, utcnow
from .config import settings
from .db import Base, TimestampMixin, get_session, session_scope
from .errors import Conflict, Forbidden, Invalid, NotFound, VesperError
from .events import Event, Envelope, bus
from .permissions import ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, Perm, Role, permissions_for
from .security import Principal, current_guest, current_principal, current_user, requires

__all__ = [
    "ALL_PERMISSIONS",
    "Base",
    "Conflict",
    "DEFAULT_ROLE_PERMISSIONS",
    "Envelope",
    "Event",
    "Forbidden",
    "Invalid",
    "NotFound",
    "Perm",
    "Principal",
    "Role",
    "TimestampMixin",
    "VesperError",
    "bus",
    "create_app",
    "current_guest",
    "current_principal",
    "current_user",
    "get_session",
    "local_today",
    "on_events",
    "permissions_for",
    "requires",
    "session_scope",
    "settings",
    "to_local",
    "utcnow",
]
