"""The permission matrix.

Permissions are `resource:verb` strings. Roles are bundles of them, editable in the admin
panel (Day 2) — the constants here are the shipped defaults, and a role's stored grant
list always wins over this file at runtime.
"""
from enum import StrEnum


class Role(StrEnum):
    GM = "gm"
    MANAGER = "manager"
    STAFF = "staff"


class Perm(StrEnum):
    # Identity & system
    USERS_READ = "users:read"
    USERS_WRITE = "users:write"
    ROLES_WRITE = "roles:write"
    AUDIT_READ = "audit:read"
    SETTINGS_WRITE = "settings:write"
    SHADOW_TOGGLE = "shadow:toggle"

    # Property
    PROPERTY_READ = "property:read"
    PROPERTY_WRITE = "property:write"
    IMPORT_RUN = "import:run"

    # Staff
    ATTENDANCE_MARK = "attendance:mark"
    ATTENDANCE_READ_TEAM = "attendance:read_team"
    TASKS_READ = "tasks:read"
    TASKS_ASSIGN = "tasks:assign"
    TASKS_COMPLETE = "tasks:complete"
    ROOMS_STATUS_WRITE = "rooms:status_write"

    # Guest-facing
    REQUESTS_READ = "requests:read"
    REQUESTS_ACCEPT = "requests:accept"
    ISSUES_WRITE = "issues:write"
    # Staff record their own view of a guest; managers read the aggregate. Split because
    # they are different acts: one is first-hand, the other decides how a guest is
    # treated on the way out.
    GUEST_REVIEW_WRITE = "guest_review:write"
    GUEST_REVIEW_READ = "guest_review:read"
    # The other direction: guests rating staff. Guests write these with a room token and
    # hold no permission at all, so there is no write entry here. Reading is split the
    # same way as above, and for a sharper reason — a staff member seeing their own
    # score is feedback, and one seeing everybody's is a ranking of their colleagues.
    STAFF_REVIEW_READ_OWN = "staff_review:read_own"
    STAFF_REVIEW_READ = "staff_review:read"

    # Inventory
    STOCK_READ = "stock:read"
    STOCK_WRITE = "stock:write"
    PURCHASE_APPROVE = "purchase:approve"

    # Front desk
    BOOKINGS_READ = "bookings:read"
    BOOKINGS_WRITE = "bookings:write"
    GUESTS_READ = "guests:read"

    # Decision layer
    CARDS_READ = "cards:read"
    CARDS_APPROVE = "cards:approve"
    CARDS_DISMISS = "cards:dismiss"
    RATES_APPROVE = "rates:approve"
    ROSTER_APPROVE = "roster:approve"
    WORKORDER_APPROVE = "workorder:approve"
    # Running the asset risk sweep. Separate from property:write because scoring your own
    # department's equipment is not the same authority as editing the resort.
    MAINTENANCE_RUN = "maintenance:run"
    OFFERS_APPROVE = "offers:approve"

    # Intelligence surfaces
    FORECAST_READ = "forecast:read"
    SIMULATOR_RUN = "simulator:run"
    LEARNING_READ = "learning:read"
    CONCIERGE_USE = "concierge:use"
    DASHBOARD_READ = "dashboard:read"


STAFF_PERMS: set[str] = {
    Perm.ATTENDANCE_MARK,
    Perm.TASKS_READ,
    Perm.TASKS_COMPLETE,
    Perm.STAFF_REVIEW_READ_OWN,
}

MANAGER_PERMS: set[str] = {
    Perm.PROPERTY_READ,
    Perm.ATTENDANCE_READ_TEAM,
    Perm.TASKS_READ,
    Perm.TASKS_ASSIGN,
    Perm.TASKS_COMPLETE,
    Perm.ROOMS_STATUS_WRITE,
    Perm.REQUESTS_READ,
    Perm.REQUESTS_ACCEPT,
    Perm.ISSUES_WRITE,
    Perm.STOCK_READ,
    Perm.STOCK_WRITE,
    Perm.BOOKINGS_READ,
    Perm.BOOKINGS_WRITE,
    Perm.GUESTS_READ,
    Perm.GUEST_REVIEW_READ,
    Perm.STAFF_REVIEW_READ,
    Perm.CARDS_APPROVE,
    Perm.CARDS_DISMISS,
    Perm.CARDS_READ,
    Perm.WORKORDER_APPROVE,
    Perm.MAINTENANCE_RUN,
    Perm.ROSTER_APPROVE,
    Perm.PURCHASE_APPROVE,
    Perm.FORECAST_READ,
    Perm.CONCIERGE_USE,
    Perm.DASHBOARD_READ,
}

GM_PERMS: set[str] = {
    Perm.PROPERTY_READ,
    Perm.USERS_WRITE,
    Perm.USERS_READ,
    Perm.ROLES_WRITE,
    Perm.PROPERTY_WRITE,
    Perm.IMPORT_RUN,
    Perm.AUDIT_READ,
    Perm.SETTINGS_WRITE,
    Perm.SHADOW_TOGGLE,
    Perm.ATTENDANCE_READ_TEAM,
    Perm.TASKS_READ,
    Perm.TASKS_ASSIGN,
    Perm.REQUESTS_READ,
    Perm.STOCK_READ,
    Perm.BOOKINGS_READ,
    Perm.GUESTS_READ,
    Perm.STAFF_REVIEW_READ,
    Perm.CARDS_READ,
    Perm.CARDS_APPROVE,
    Perm.CARDS_DISMISS,
    Perm.WORKORDER_APPROVE,
    Perm.MAINTENANCE_RUN,
    Perm.ROSTER_APPROVE,
    Perm.PURCHASE_APPROVE,
    Perm.CONCIERGE_USE,
    Perm.RATES_APPROVE,
    Perm.OFFERS_APPROVE,
    Perm.SIMULATOR_RUN,
    Perm.LEARNING_READ,
}

DEFAULT_ROLE_PERMISSIONS: dict[str, set[str]] = {
    Role.GM: GM_PERMS,
    Role.MANAGER: MANAGER_PERMS,
    Role.STAFF: STAFF_PERMS,
}

STAFF_DEPARTMENTAL_EXTRAS: set[str] = {
    Perm.TASKS_ASSIGN,
    Perm.ATTENDANCE_READ_TEAM,
    Perm.STOCK_WRITE,
    Perm.STOCK_READ,
    Perm.ROOMS_STATUS_WRITE,
    Perm.REQUESTS_READ,
    Perm.REQUESTS_ACCEPT,
    Perm.ISSUES_WRITE,
    Perm.GUEST_REVIEW_WRITE,
}

GM_REQUIRED_PERMISSIONS: set[str] = {
    Perm.USERS_READ,
    Perm.USERS_WRITE,
    Perm.ROLES_WRITE,
    Perm.AUDIT_READ,
    Perm.DASHBOARD_READ,
    Perm.FORECAST_READ,
    Perm.LEARNING_READ,
    Perm.SIMULATOR_RUN,
}


def allowed_permissions_for_role(role: str) -> set[str]:
    allowed = {str(p) for p in DEFAULT_ROLE_PERMISSIONS.get(role, set())}
    if role == Role.STAFF:
        allowed |= {str(p) for p in STAFF_DEPARTMENTAL_EXTRAS}
    return allowed

ALL_PERMISSIONS: list[str] = sorted(p.value for p in Perm)


def permissions_for(role: str) -> set[str]:
    return {str(p) for p in DEFAULT_ROLE_PERMISSIONS.get(role, set())}


def permission_matrix() -> dict[str, list[str]]:
    """Shape the admin panel's matrix editor renders (Day 2)."""
    return {role: sorted(str(p) for p in perms) for role, perms in DEFAULT_ROLE_PERMISSIONS.items()}
