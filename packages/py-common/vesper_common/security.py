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
from .permissions import Role

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
            "role": Role.GUEST.value,
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

    @property
    def is_guest(self) -> bool:
        return self.kind == GUEST

    def can(self, permission: str) -> bool:
        return permission in self.permissions

    def require(self, permission: str) -> None:
        if not self.can(permission):
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Missing permission: {permission}")


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


def current_user(principal: Principal = Depends(current_principal)) -> Principal:
    """Staff-only routes: rejects guest QR tokens."""
    if principal.is_guest:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Staff token required")
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


def token_from_query(token: str) -> Principal:
    """WebSocket auth — browsers cannot set headers on a WebSocket handshake."""
    return principal_from_payload(decode_token(token))
