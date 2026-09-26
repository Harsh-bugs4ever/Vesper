"""Tokens, password hashing and the request-level auth dependencies.

Two kinds of principal:
  * staff  — email + password, a role, a department, a permission set baked into the JWT
  * guest  — no account at all, a token minted from a room QR and valid only while that
             room is occupied (guest-service revalidates the stay on every call)
"""
import bcrypt

if not hasattr(bcrypt, "__about__"):
    class _BcryptAbout:
        __version__ = getattr(bcrypt, "__version__", "4.0.0")
    bcrypt.__about__ = _BcryptAbout()  # type: ignore[attr-defined]

from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext

from .clock import utcnow
from .config import settings
from .permissions import DEFAULT_ROLE_PERMISSIONS, Role
from .db import get_session
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select
from uuid import UUID

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

ACCESS = "access"
REFRESH = "refresh"
GUEST = "guest"


def hash_password(raw: str) -> str:
    return pwd_context.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    return pwd_context.verify(raw, hashed)


def _encode(payload: dict[str, Any], lifetime: timedelta) -> str:
    now = utcnow()
    body = {**payload, "iat": now, "exp": now + lifetime, "iss": "vesper"}
    return jwt.encode(body, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(
    *, user_id: str, property_id: str, role: str, permissions: set[str], department_id: str | None = None
) -> str:
    return _encode(
        {
            "sub": user_id,
            "typ": ACCESS,
            "pid": property_id,
            "role": role,
            "dept": department_id,
            "perms": sorted(permissions),
        },
        timedelta(minutes=settings.access_token_minutes),
    )


def create_refresh_token(*, user_id: str) -> str:
    return _encode({"sub": user_id, "typ": REFRESH}, timedelta(days=settings.refresh_token_days))


def create_guest_token(*, stay_id: str, room_id: str, property_id: str, guest_id: str | None) -> str:
    """Minted when a room QR is scanned. Short-lived, single room, no account."""
    return _encode(
        {
            "sub": f"stay:{stay_id}",
            "typ": GUEST,
            "pid": property_id,
            "role": GUEST,
            "stay": stay_id,
            "room": room_id,
            "guest": guest_id,
            "perms": [],
        },
        timedelta(minutes=settings.guest_token_minutes),
    )


def decode_token(token: str, *, expect: str | None = None) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm], issuer="vesper")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired") from None
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from None
    if expect and payload.get("typ") != expect:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    return payload


@dataclass(slots=True)
class Principal:
    id: str
    property_id: str
    role: str
    kind: str = ACCESS
    department_id: str | None = None
    permissions: set[str] = field(default_factory=set)
    stay_id: str | None = None
    room_id: str | None = None
    guest_id: str | None = None
    property_ids: set[str] = field(default_factory=set)
    department_ids: set[str] = field(default_factory=set)

    @property
    def is_guest(self) -> bool:
        return self.kind == GUEST

    def can(self, permission: str) -> bool:
        return permission in self.permissions

    def require(self, permission: str) -> None:
        if not self.can(permission):
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Missing permission: {permission}")

    def require_property(self, property_id: str | UUID) -> None:
        if str(property_id) not in self.property_ids:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Property is outside your assignment")

    def require_department(self, department_id: str | UUID | None) -> None:
        if department_id is None or (self.role not in {Role.GM, "service"} and str(department_id) not in self.department_ids):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Department is outside your assignment")

    def can_see_department(self, department_id: str | UUID | None) -> bool:
        return bool(department_id is not None and (self.role in {Role.GM, "service"} or str(department_id) in self.department_ids))

    def can_see_event(self, department_id: str | UUID | None) -> bool:
        return self.role == Role.GM or self.can_see_department(department_id)

    def scoped_department(self, requested: str | UUID | None) -> UUID | None:
        if requested is not None:
            self.require_department(requested)
            return UUID(str(requested))
        if self.role in {Role.GM, "service"}:
            return None
        if len(self.department_ids) == 1:
            return UUID(next(iter(self.department_ids)))
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Select an assigned department")

    def require_department_key(self, db: Session, key: str) -> None:
        if self.role in {Role.GM, "service"}:
            return
        from app.api.property.models import Department
        department_id = db.scalar(select(Department.id).where(Department.property_id == UUID(self.property_id), Department.key == key))
        self.require_department(department_id)

    def require_department_record(self, db: Session, department_id: str | UUID | None) -> None:
        self.require_department(department_id)
        from app.api.property.models import Department
        if db.scalar(select(Department.id).where(Department.id == UUID(str(department_id)), Department.property_id == UUID(self.property_id))) is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Department does not belong to this property")

    def require_object(self, obj: Any, *, owner_field: str | None = None) -> None:
        self.require_property(getattr(obj, "property_id", None))
        if self.role in {Role.GM, "service"}:
            return
        department_id = getattr(obj, "department_id", None)
        if department_id is not None and self.can_see_department(department_id):
            return
        if owner_field and str(getattr(obj, owner_field, None)) == self.id:
            return
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Record not found")


def principal_from_payload(payload: dict[str, Any]) -> Principal:
    return Principal(
        id=str(payload.get("sub")),
        property_id=str(payload.get("pid", "")),
        role=str(payload.get("role", "")),
        kind=str(payload.get("typ", ACCESS)),
        department_id=payload.get("dept"),
        permissions=set(payload.get("perms") or []),
        stay_id=payload.get("stay"),
        room_id=payload.get("room"),
        guest_id=payload.get("guest"),
    )


def current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Principal:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return principal_from_payload(decode_token(credentials.credentials))


def current_user(principal: Principal = Depends(current_principal), db: Session = Depends(get_session)) -> Principal:
    """Staff-only routes: rejects guest QR tokens."""
    return authorize_staff_principal(principal, db)


def authorize_staff_principal(principal: Principal, db: Session) -> Principal:
    """Resolve live grants; JWT role and permissions are never an authority for people."""
    if principal.is_guest:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Staff token required")
    if principal.role == "service" and principal.id.startswith("service:"):
        principal.property_ids = {principal.property_id}
        return principal
    if principal.kind != ACCESS:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Access token required")
    from app.api.identity.models import User
    from app.api.property.models import Department, Property
    try:
        user_id = UUID(principal.id)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid account") from None
    user = db.scalars(select(User).options(joinedload(User.role), joinedload(User.assignments)).where(User.id == user_id)).unique().first()
    if user is None or not user.is_active or user.role.key not in DEFAULT_ROLE_PERMISSIONS or user.role.property_id != user.property_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account no longer authorized")
    assignments = [a for a in user.assignments if a.property_id is not None]
    property_ids = {str(a.property_id) for a in assignments}
    if principal.property_id not in property_ids:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Property assignment revoked")
    if db.get(Property, UUID(principal.property_id)) is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Property no longer exists")
    departments = {str(a.department_id) for a in assignments if str(a.property_id) == principal.property_id and a.department_id}
    if departments:
        existing = {str(value) for value in db.scalars(select(Department.id).where(Department.property_id == UUID(principal.property_id), Department.id.in_([UUID(value) for value in departments])))}
        departments &= existing
    if user.role.key != Role.GM and not departments:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Department assignment required")
    if user.role.key == Role.GM and not any(a.department_id is None and str(a.property_id) == principal.property_id for a in assignments):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Branch overview assignment required")
    principal.role = user.role.key
    principal.permissions = set(user.permissions)
    principal.property_ids = property_ids
    principal.department_ids = departments
    principal.department_id = next(iter(sorted(departments)), None)
    return principal


def current_guest(principal: Principal = Depends(current_principal)) -> Principal:
    if not principal.is_guest:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Guest token required")
    return principal


def requires(*permissions: str):
    """Route dependency: `Depends(requires(Perm.RATES_APPROVE))`."""

    def dependency(principal: Principal = Depends(current_user)) -> Principal:
        for permission in permissions:
            principal.require(str(permission))
        return principal

    return dependency


def requires_gm(*permissions: str):
    """Specialist analytics require a live GM role, not an old permission grant."""
    def dependency(principal: Principal = Depends(current_user)) -> Principal:
        if principal.role not in {Role.GM, "service"}:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "General Manager access required")
        for permission in permissions:
            principal.require(str(permission))
        return principal

    return dependency


def token_from_query(token: str) -> Principal:
    """WebSocket auth — browsers cannot set headers on a WebSocket handshake."""
    return principal_from_payload(decode_token(token))
