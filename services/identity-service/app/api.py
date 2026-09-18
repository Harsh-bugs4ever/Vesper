from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import ALL_PERMISSIONS, Perm
from vesper_common.security import Principal, current_user, requires

from . import service
from .schemas import (
    LoginRequest,
    MatrixOut,
    MeOut,
    RefreshRequest,
    RoleOut,
    RolePermissionsUpdate,
    RoleUpsert,
    TokenPair,
    UserCreate,
    UserDetail,
    UserOut,
    UserUpdate,
)

auth_router = APIRouter(prefix="/auth", tags=["auth"])
admin_router = APIRouter(prefix="/admin", tags=["identity-admin"])


@auth_router.post("/login", response_model=TokenPair)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_session)) -> TokenPair:
    tokens = service.login(
        db, body.email, body.password, user_agent=request.headers.get("user-agent")
    )
    return TokenPair(**tokens)


@auth_router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest, db: Session = Depends(get_session)) -> TokenPair:
    return TokenPair(**service.refresh(db, body.refresh_token))


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, db: Session = Depends(get_session)) -> None:
    service.logout(db, body.refresh_token)


@auth_router.get("/me", response_model=MeOut)
def me(principal: Principal = Depends(current_user), db: Session = Depends(get_session)) -> MeOut:
    user = service.get_user(db, UUID(principal.id))
    return MeOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.key,
        department_id=user.department_id,
        property_id=user.property_id,
        permissions=sorted(user.permissions),
    )


@admin_router.get("/permissions", response_model=list[str])
def permissions(_: Principal = Depends(requires(Perm.USERS_READ))) -> list[str]:
    return ALL_PERMISSIONS


@admin_router.get("/matrix", response_model=MatrixOut)
def matrix(
    principal: Principal = Depends(requires(Perm.USERS_READ)), db: Session = Depends(get_session)
) -> MatrixOut:
    roles = service.list_roles(db, UUID(principal.property_id))
    return MatrixOut(permissions=ALL_PERMISSIONS, roles=[RoleOut.model_validate(r) for r in roles])


@admin_router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    body: RoleUpsert,
    principal: Principal = Depends(requires(Perm.ROLES_WRITE)),
    db: Session = Depends(get_session),
) -> RoleOut:
    return RoleOut.model_validate(service.create_role(db, UUID(principal.property_id), body))


@admin_router.put("/roles/{key}/permissions", response_model=RoleOut)
def set_role_permissions(
    key: str,
    body: RolePermissionsUpdate,
    principal: Principal = Depends(requires(Perm.ROLES_WRITE)),
    db: Session = Depends(get_session),
) -> RoleOut:
    role = service.set_role_permissions(db, UUID(principal.property_id), key, body.permissions)
    return RoleOut.model_validate(role)


@admin_router.get("/users", response_model=list[UserOut])
def list_users(
    department_id: UUID | None = None,
    search: str | None = None,
    principal: Principal = Depends(requires(Perm.USERS_READ)),
    db: Session = Depends(get_session),
) -> list[UserOut]:
    users = service.list_users(
        db, UUID(principal.property_id), department_id=department_id, search=search
    )
    return [UserOut.model_validate(u) for u in users]


@admin_router.post("/users", response_model=UserDetail, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    principal: Principal = Depends(requires(Perm.USERS_WRITE)),
    db: Session = Depends(get_session),
) -> UserDetail:
    return _detail(service.create_user(db, UUID(principal.property_id), body))


@admin_router.patch("/users/{user_id}", response_model=UserDetail)
def update_user(
    user_id: UUID,
    body: UserUpdate,
    principal: Principal = Depends(requires(Perm.USERS_WRITE)),
    db: Session = Depends(get_session),
) -> UserDetail:
    return _detail(service.update_user(db, UUID(principal.property_id), user_id, body))


@admin_router.get("/users/{user_id}", response_model=UserDetail)
def get_user(
    user_id: UUID,
    _: Principal = Depends(requires(Perm.USERS_READ)),
    db: Session = Depends(get_session),
) -> UserDetail:
    return _detail(service.get_user(db, user_id))


def _detail(user) -> UserDetail:
    return UserDetail(
        **UserOut.model_validate(user).model_dump(),
        role_key=user.role.key,
        permissions=sorted(user.permissions),
    )
