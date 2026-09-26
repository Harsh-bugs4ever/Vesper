"""Login, token rotation and user administration."""
from __future__ import annotations

import hashlib
import logging
from datetime import timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from vesper_common.clock import utcnow
from vesper_common.config import settings
from vesper_common.errors import Conflict, Forbidden, Invalid, NotFound
from vesper_common.permissions import ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, GM_REQUIRED_PERMISSIONS, allowed_permissions_for_role
from app.api.property.models import Department, Property
from vesper_common.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

from .models import RefreshSession, Role, User, UserAssignment

log = logging.getLogger(__name__)


def _fingerprint(token: str) -> str:
    """Refresh tokens are stored hashed — a leaked database must not grant sessions."""
    return hashlib.sha256(token.encode()).hexdigest()


def get_user(db: Session, user_id: UUID) -> User:
    user = db.scalars(select(User).options(joinedload(User.role), joinedload(User.assignments)).where(User.id == user_id)).unique().first()
    if user is None:
        raise NotFound("User not found")
    return user


def get_role(db: Session, property_id: UUID, key: str) -> Role:
    if key not in DEFAULT_ROLE_PERMISSIONS:
        raise Invalid("Unsupported role")
    role = db.scalars(select(Role).where(Role.property_id == property_id, Role.key == key)).first()
    if role is None:
        raise NotFound(f"Role '{key}' not found")
    return role


def issue_tokens(db: Session, user: User, *, user_agent: str | None = None) -> dict:
    if not user.is_active or user.role.key not in DEFAULT_ROLE_PERMISSIONS or not user.assignments:
        raise Forbidden("Account has no active assignment")
    access = create_access_token(
        user_id=str(user.id),
        property_id=str(user.property_id),
        role=user.role.key,
        permissions=user.permissions,
        department_id=str(user.department_id) if user.department_id else None,
    )
    refresh = create_refresh_token(user_id=str(user.id))
    db.add(
        RefreshSession(
            user_id=user.id,
            token_hash=_fingerprint(refresh),
            expires_at=utcnow() + timedelta(days=settings.refresh_token_days),
            user_agent=(user_agent or "")[:200] or None,
        )
    )
    user.last_login_at = utcnow()
    db.commit()
    return {
        "access_token": access,
        "refresh_token": refresh,
        "expires_in": settings.access_token_minutes * 60,
    }


def login(db: Session, email: str, password: str, *, user_agent: str | None = None) -> dict:
    user = db.scalars(
        select(User).options(joinedload(User.role)).where(User.email == email.lower().strip())
    ).first()
    # Same message either way: never tell an attacker which half was wrong.
    if user is None or not verify_password(password, user.password_hash):
        raise Forbidden("Incorrect email or password")
    if not user.is_active:
        raise Forbidden("This account has been deactivated")
    return issue_tokens(db, user, user_agent=user_agent)


def refresh(db: Session, refresh_token: str) -> dict:
    payload = decode_token(refresh_token, expect="refresh")
    fingerprint = _fingerprint(refresh_token)
    session_row = db.scalars(
        select(RefreshSession).where(RefreshSession.token_hash == fingerprint)
    ).first()
    if session_row is None or session_row.revoked_at is not None:
        raise Forbidden("Refresh token is no longer valid")
    if session_row.expires_at <= utcnow():
        raise Forbidden("Refresh token expired")

    # Rotation: the presented token dies as the new pair is minted.
    session_row.revoked_at = utcnow()
    return issue_tokens(db, get_user(db, UUID(payload["sub"])))


def logout(db: Session, refresh_token: str) -> None:
    row = db.scalars(
        select(RefreshSession).where(RefreshSession.token_hash == _fingerprint(refresh_token))
    ).first()
    if row and row.revoked_at is None:
        row.revoked_at = utcnow()
        db.commit()


def list_roles(db: Session, property_id: UUID) -> list[Role]:
    return list(db.scalars(select(Role).where(Role.property_id == property_id, Role.key.in_(DEFAULT_ROLE_PERMISSIONS)).order_by(Role.key)))


def set_role_permissions(db: Session, property_id: UUID, key: str, permissions: list[str]) -> Role:
    role = get_role(db, property_id, key)
    unknown = sorted(set(permissions) - set(ALL_PERMISSIONS))
    if unknown:
        raise Invalid("Unknown permissions", details={"permissions": unknown})
    disallowed = sorted(set(permissions) - allowed_permissions_for_role(key))
    if disallowed:
        raise Invalid("Permissions are outside this role", details={"permissions": disallowed})
    if key == "gm":
        missing = {str(permission) for permission in GM_REQUIRED_PERMISSIONS} - set(permissions)
        if missing:
            raise Invalid("General Manager permissions are required", details={"permissions": sorted(missing)})
    role.permissions = sorted(set(permissions))
    role.is_system = False
    db.commit()
    db.refresh(role)
    return role


def list_users(
    db: Session, property_id: UUID, *, department_id: UUID | None = None, search: str | None = None
) -> list[User]:
    query = select(User).options(joinedload(User.role), joinedload(User.assignments)).where(User.property_id == property_id)
    if department_id:
        query = query.where(User.department_id == department_id)
    if search:
        needle = f"%{search.lower()}%"
        query = query.where(User.full_name.ilike(needle) | User.email.ilike(needle))
    return list(db.scalars(query.order_by(User.full_name)).unique())


def _assign(db: Session, user: User, role_key: str, assignments, allowed_properties: set[UUID]) -> None:
    if not assignments:
        raise Invalid("At least one branch/department assignment is required")
    grants = []
    seen = set()
    for grant in assignments:
        if grant.property_id not in allowed_properties or db.get(Property, grant.property_id) is None:
            raise Forbidden("Property is outside your assignment")
        if role_key == "gm":
            if grant.department_id is not None:
                raise Invalid("General Manager assignments must be at branch level")
        elif grant.department_id is None:
            raise Invalid("Department assignment is required")
        elif db.scalars(select(Department.id).where(Department.id == grant.department_id, Department.property_id == grant.property_id)).first() is None:
            raise Invalid("Department does not belong to the branch")
        key = (grant.property_id, grant.department_id)
        if key not in seen:
            grants.append(UserAssignment(property_id=grant.property_id, department_id=grant.department_id))
            seen.add(key)
    if user.property_id not in {a.property_id for a in grants}:
        raise Invalid("Home branch must remain assigned")
    user.assignments = grants
    user.department_id = next((a.department_id for a in grants if a.property_id == user.property_id), None)


def create_user(db: Session, property_id: UUID, data, *, allowed_properties: set[UUID] | None = None) -> User:
    email = data.email.lower().strip()
    if db.scalars(select(User).where(User.property_id == property_id, User.email == email)).first():
        raise Conflict("A user with that email already exists")
    role = get_role(db, property_id, data.role_key)
    disallowed = set(data.extra_permissions) - allowed_permissions_for_role(role.key)
    if disallowed:
        raise Invalid("Permissions are outside this role", details={"permissions": sorted(disallowed)})
    user = User(
        property_id=property_id,
        department_id=data.department_id,
        role_id=role.id,
        email=email,
        full_name=data.full_name,
        phone=data.phone,
        employee_code=data.employee_code,
        password_hash=hash_password(data.password),
        extra_permissions=sorted(set(data.extra_permissions) & set(ALL_PERMISSIONS)),
    )
    from .schemas import AssignmentIn
    grants = data.assignments or [AssignmentIn(property_id=property_id, department_id=data.department_id)]
    _assign(db, user, role.key, grants, allowed_properties or {property_id})
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, property_id: UUID, user_id: UUID, data, *, allowed_properties: set[UUID] | None = None) -> User:
    user = get_user(db, user_id)
    if user.property_id != property_id:
        raise NotFound("User not found")
    if data.role_key is not None:
        user.role = get_role(db, property_id, data.role_key)
    for field in ("full_name", "phone", "is_active"):
        value = getattr(data, field)
        if value is not None:
            setattr(user, field, value)
    if data.assignments is not None or data.department_id is not None or data.role_key is not None:
        from .schemas import AssignmentIn
        grants = data.assignments
        if grants is None and data.department_id is not None:
            grants = [AssignmentIn(property_id=property_id, department_id=data.department_id)]
        if grants is None:
            grants = user.assignments
        _assign(db, user, data.role_key or user.role.key, grants, allowed_properties or {property_id})
    if data.extra_permissions is not None:
        disallowed = set(data.extra_permissions) - allowed_permissions_for_role(data.role_key or user.role.key)
        if disallowed:
            raise Invalid("Permissions are outside this role", details={"permissions": sorted(disallowed)})
        user.extra_permissions = sorted(set(data.extra_permissions) & set(ALL_PERMISSIONS))
    if data.password:
        user.password_hash = hash_password(data.password)
        # Changing a password ends every other session for that user.
        for row in db.scalars(select(RefreshSession).where(RefreshSession.user_id == user.id)):
            row.revoked_at = row.revoked_at or utcnow()
    if data.role_key is not None or data.assignments is not None or data.department_id is not None or data.is_active is False:
        for row in db.scalars(select(RefreshSession).where(RefreshSession.user_id == user.id, RefreshSession.revoked_at.is_(None))):
            row.revoked_at = utcnow()
    db.commit()
    db.refresh(user)
    return user


def ensure_default_roles(db: Session, property_id: UUID) -> None:
    """Create the shipped roles, and keep the system ones in step with the code.

    Idempotent: seeding and first boot both call this.

    Existing system roles are re-synced rather than skipped. Skipping them meant that
    adding a permission to a role in code reached nobody on an already-seeded database —
    the endpoint simply 403'd for the role that was supposed to have it, with nothing to
    show why.

    Roles an operator created or edited in the admin panel are never touched: `is_system`
    is what separates "this is ours to define" from "a human decided this".
    """
    by_key = {r.key: r for r in list_roles(db, property_id)}
    for key, perms in DEFAULT_ROLE_PERMISSIONS.items():
        wanted = sorted(str(p) for p in perms)
        existing = by_key.get(str(key))

        if existing is None:
            db.add(
                Role(
                    property_id=property_id,
                    key=str(key),
                    label="General Manager" if key == "gm" else str(key).title(),
                    permissions=wanted,
                    is_system=True,
                )
            )
        elif existing.is_system and sorted(existing.permissions) != wanted:
            added = sorted(set(wanted) - set(existing.permissions))
            removed = sorted(set(existing.permissions) - set(wanted))
            log.info("syncing role %s: +%s -%s", key, added or "none", removed or "none")
            existing.permissions = wanted
    db.commit()
