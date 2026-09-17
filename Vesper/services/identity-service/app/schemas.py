from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class RoleOut(ORMModel):
    id: UUID
    key: str
    label: str
    permissions: list[str]
    is_system: bool


class RoleUpsert(BaseModel):
    key: str = Field(min_length=2, max_length=48)
    label: str = Field(min_length=2, max_length=80)
    permissions: list[str] = Field(default_factory=list)


class RolePermissionsUpdate(BaseModel):
    permissions: list[str]


class UserOut(ORMModel):
    id: UUID
    email: EmailStr
    full_name: str
    phone: str | None = None
    employee_code: str | None = None
    department_id: UUID | None = None
    role_id: UUID
    is_active: bool
    last_login_at: datetime | None = None


class UserDetail(UserOut):
    role_key: str
    permissions: list[str]


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=6, max_length=128)
    role_key: str
    department_id: UUID | None = None
    phone: str | None = None
    employee_code: str | None = None
    extra_permissions: list[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    department_id: UUID | None = None
    role_key: str | None = None
    extra_permissions: list[str] | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)


class MatrixOut(BaseModel):
    """Feeds the admin panel's permission matrix editor."""

    permissions: list[str]
    roles: list[RoleOut]


class MeOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: str
    department_id: UUID | None
    property_id: UUID
    permissions: list[str]
