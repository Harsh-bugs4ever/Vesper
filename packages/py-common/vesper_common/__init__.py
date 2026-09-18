"""Shared building blocks for every Vesper service.

Re-exports are resolved lazily (PEP 562). Thirteen services share this package but not
its whole dependency set — the gateway has no ORM, the notification worker has no
password hashing — so importing one name must not drag in every third-party library.
`from vesper_common import Perm` costs nothing but the permissions module.
"""
from typing import TYPE_CHECKING

# name -> submodule it lives in
_EXPORTS: dict[str, str] = {
    "create_app": "app_factory",
    "on_events": "app_factory",
    "local_today": "clock",
    "to_local": "clock",
    "utcnow": "clock",
    "settings": "config",
    "Base": "db",
    "TimestampMixin": "db",
    "get_session": "db",
    "session_scope": "db",
    "Conflict": "errors",
    "Forbidden": "errors",
    "Invalid": "errors",
    "NotFound": "errors",
    "VesperError": "errors",
    "Envelope": "events",
    "Event": "events",
    "bus": "events",
    "ALL_PERMISSIONS": "permissions",
    "DEFAULT_ROLE_PERMISSIONS": "permissions",
    "Perm": "permissions",
    "Role": "permissions",
    "permissions_for": "permissions",
    "Principal": "security",
    "current_guest": "security",
    "current_principal": "security",
    "current_user": "security",
    "requires": "security",
}

__all__ = sorted(_EXPORTS)


def __getattr__(name: str):
    module_name = _EXPORTS.get(name)
    if module_name is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    from importlib import import_module

    value = getattr(import_module(f".{module_name}", __name__), name)
    globals()[name] = value  # cache it, so the lookup happens once
    return value


def __dir__() -> list[str]:
    return __all__


if TYPE_CHECKING:  # give type checkers and IDEs the real symbols
    from .app_factory import create_app, on_events
    from .clock import local_today, to_local, utcnow
    from .config import settings
    from .db import Base, TimestampMixin, get_session, session_scope
    from .errors import Conflict, Forbidden, Invalid, NotFound, VesperError
    from .events import Envelope, Event, bus
    from .permissions import ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, Perm, Role, permissions_for
    from .security import Principal, current_guest, current_principal, current_user, requires
