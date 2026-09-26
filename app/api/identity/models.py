"""Identity tables: users, roles, refresh sessions.

Owned by identity-service. Departments and properties live in property-service, so the
columns pointing at them are plain UUIDs, not foreign keys.
"""
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from vesper_common.db import Base, TimestampMixin, uuid_pk, uuid_ref

SCHEMA = "identity"


class Role(Base, TimestampMixin):
    """A named bundle of permissions. Editable in the admin panel."""

    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("property_id", "key"), {"schema": SCHEMA})

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    key: Mapped[str] = mapped_column(String(48), nullable=False)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    # The stored grant list always wins over the defaults in vesper_common.permissions.
    permissions: Mapped[list[str]] = mapped_column(ARRAY(String(64)), default=list, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    users: Mapped[list["User"]] = relationship(back_populates="role")


class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("property_id", "email"), {"schema": SCHEMA})

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    department_id: Mapped[UUID | None] = uuid_ref()
    role_id: Mapped[UUID] = mapped_column(ForeignKey(f"{SCHEMA}.roles.id"), nullable=False, index=True)

    email: Mapped[str] = mapped_column(String(160), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(24))
    employee_code: Mapped[str | None] = mapped_column(String(24), index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # Per-user overrides layered on top of the role, for the one person who also
    # approves rates while their manager is on leave.
    extra_permissions: Mapped[list[str]] = mapped_column(ARRAY(String(64)), default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    role: Mapped[Role] = relationship(back_populates="users")
    assignments: Mapped[list["UserAssignment"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    @property
    def permissions(self) -> set[str]:
        from vesper_common.permissions import GM_REQUIRED_PERMISSIONS, Role as RoleKey, allowed_permissions_for_role
        granted = (set(self.role.permissions) | set(self.extra_permissions or [])) & allowed_permissions_for_role(self.role.key)
        if self.role.key == RoleKey.GM:
            granted |= {str(permission) for permission in GM_REQUIRED_PERMISSIONS}
        return granted


class UserAssignment(Base, TimestampMixin):
    """An independent branch/department grant; NULL department grants branch overview to a GM."""

    __tablename__ = "user_assignments"
    __table_args__ = (UniqueConstraint("user_id", "property_id", "department_id"), {"schema": SCHEMA})

    id: Mapped[UUID] = uuid_pk()
    user_id: Mapped[UUID] = mapped_column(ForeignKey(f"{SCHEMA}.users.id"), nullable=False, index=True)
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    department_id: Mapped[UUID | None] = uuid_ref()
    user: Mapped[User] = relationship(back_populates="assignments")


class RefreshSession(Base, TimestampMixin):
    """One row per issued refresh token, so a logout actually revokes something."""

    __tablename__ = "refresh_sessions"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    user_id: Mapped[UUID] = mapped_column(ForeignKey(f"{SCHEMA}.users.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(200))
