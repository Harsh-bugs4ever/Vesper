"""The shared surface every route handler depends on.

One import for the things that used to be scattered across thirteen services:
the database session, the event bus, the permission matrix, and the JWT helpers.

Nothing is reimplemented here — it all still lives in `vesper_common`, which the
monolith and the scripts (seed, simulator, contract export) share. This module
exists so a handler can write

    from app.dependencies import get_session, current_user, Perm, requires

instead of reaching into three packages, and so there is one obvious place to look
when asking what a handler is allowed to depend on.
"""
from vesper_common.clock import (
    as_utc,
    local_day_bounds,
    local_today,
    minutes_between,
    property_tz,
    to_local,
    utcnow,
)
from vesper_common.config import Settings, get_settings, settings
from vesper_common.db import (
    Base,
    SCHEMAS,
    get_engine,
    get_session,
    session_scope,
)
from vesper_common.errors import Conflict, Forbidden, Invalid, NotFound, VesperError
from vesper_common.events import Envelope, Event, bus

# The permission matrix is identity's, and it is imported — never copied. A second
# definition of what a housekeeper may do is a second thing to keep in step, and the
# one that drifts is always the copy.
from vesper_common.permissions import (
    ALL_PERMISSIONS,
    Perm,
    Role,
    permission_matrix,
    permissions_for,
)
from vesper_common.security import (
    Principal,
    create_access_token,
    create_guest_token,
    create_refresh_token,
    current_guest,
    current_principal,
    current_user,
    decode_token,
    hash_password,
    principal_from_payload,
    requires,
    token_from_query,
    verify_password,
)

__all__ = [
    # configuration
    "Settings", "get_settings", "settings",
    # database
    "Base", "SCHEMAS", "get_engine", "get_session", "session_scope",
    # events
    "Envelope", "Event", "bus",
    # errors
    "VesperError", "NotFound", "Conflict", "Forbidden", "Invalid",
    # permissions
    "Perm", "Role", "ALL_PERMISSIONS", "permission_matrix", "permissions_for",
    # authentication
    "Principal", "current_principal", "current_user", "current_guest", "requires",
    "decode_token", "principal_from_payload", "token_from_query",
    "create_access_token", "create_refresh_token", "create_guest_token",
    "hash_password", "verify_password",
    # time
    "utcnow", "property_tz", "as_utc", "to_local", "local_today",
    "local_day_bounds", "minutes_between",
]
