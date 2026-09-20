"""The permission matrix.

Permissions are `resource:verb` strings. Roles are bundles of them, editable in the admin
panel (Day 2) — the constants here are the shipped defaults, and a role's stored grant
list always wins over this file at runtime.
"""
from enum import StrEnum


class Role(StrEnum):
    OWNER = "owner"
    GM = "gm"
    MANAGER = "manager"
    SUPERVISOR = "supervisor"
    EMPLOYEE = "employee"
    GUEST = "guest"


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


EMPLOYEE_PERMS: set[str] = {
    Perm.ATTENDANCE_MARK,
    Perm.TASKS_READ,
    Perm.TASKS_COMPLETE,
    Perm.ROOMS_STATUS_WRITE,
    Perm.REQUESTS_READ,
    Perm.REQUESTS_ACCEPT,
    Perm.ISSUES_WRITE,
    Perm.STOCK_READ,
    Perm.GUEST_REVIEW_WRITE,
    Perm.STAFF_REVIEW_READ_OWN,
}

SUPERVISOR_PERMS: set[str] = EMPLOYEE_PERMS | {
    Perm.ATTENDANCE_READ_TEAM,
    Perm.TASKS_ASSIGN,
    Perm.STOCK_WRITE,
    Perm.CARDS_READ,
    Perm.PROPERTY_READ,
}

MANAGER_PERMS: set[str] = SUPERVISOR_PERMS | {
    Perm.USERS_READ,
    Perm.BOOKINGS_READ,
    Perm.BOOKINGS_WRITE,
    Perm.GUESTS_READ,
    Perm.GUEST_REVIEW_READ,
    Perm.STAFF_REVIEW_READ,
    Perm.CARDS_APPROVE,
    Perm.CARDS_DISMISS,
    Perm.WORKORDER_APPROVE,
    Perm.MAINTENANCE_RUN,
    Perm.ROSTER_APPROVE,
    Perm.PURCHASE_APPROVE,
    Perm.FORECAST_READ,
    Perm.CONCIERGE_USE,
    Perm.DASHBOARD_READ,
}

GM_PERMS: set[str] = MANAGER_PERMS | {
    Perm.USERS_WRITE,
    Perm.PROPERTY_WRITE,
    Perm.IMPORT_RUN,
    Perm.AUDIT_READ,
    Perm.RATES_APPROVE,
    Perm.OFFERS_APPROVE,
    Perm.SIMULATOR_RUN,
    Perm.LEARNING_READ,
}

OWNER_PERMS: set[str] = GM_PERMS | {
    Perm.ROLES_WRITE,
    Perm.SETTINGS_WRITE,
    Perm.SHADOW_TOGGLE,
}

# Guests hold a QR token, not an account. They may only touch their own room.
GUEST_PERMS: set[str] = {Perm.CONCIERGE_USE}

DEFAULT_ROLE_PERMISSIONS: dict[str, set[str]] = {
    Role.OWNER: OWNER_PERMS,
    Role.GM: GM_PERMS,
    Role.MANAGER: MANAGER_PERMS,
    Role.SUPERVISOR: SUPERVISOR_PERMS,
    Role.EMPLOYEE: EMPLOYEE_PERMS,
    Role.GUEST: GUEST_PERMS,
}

ALL_PERMISSIONS: list[str] = sorted(p.value for p in Perm)


def permissions_for(role: str) -> set[str]:
    return {str(p) for p in DEFAULT_ROLE_PERMISSIONS.get(role, set())}


def permission_matrix() -> dict[str, list[str]]:
    """Shape the admin panel's matrix editor renders (Day 2)."""
    return {role: sorted(str(p) for p in perms) for role, perms in DEFAULT_ROLE_PERMISSIONS.items()}
