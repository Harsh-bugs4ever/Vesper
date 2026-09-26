"""Scope checks and stale-token behavior without relying on a running database."""
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from vesper_common.permissions import DEFAULT_ROLE_PERMISSIONS, Role, Perm
from vesper_common.security import Principal, authorize_staff_principal
from app.api.identity import service as identity_service


class Rows:
    def __init__(self, row):
        self.row = row

    def unique(self):
        return self

    def first(self):
        return self.row

    def __iter__(self):
        return iter(self.row if isinstance(self.row, list) else [self.row])


class DB:
    def __init__(self, user):
        self.user = user

    def scalars(self, statement):
        if statement.column_descriptions[0]["name"] == "id":
            return Rows([assignment.department_id for assignment in self.user.assignments if assignment.department_id])
        return Rows(self.user)

    def get(self, model, key):
        return SimpleNamespace(id=key)


def account(role, property_id, departments, *, active=True, permissions=None):
    assignments = [SimpleNamespace(property_id=property_id, department_id=d) for d in departments]
    return SimpleNamespace(
        role=SimpleNamespace(key=role, property_id=property_id),
        property_id=property_id,
        is_active=active,
        assignments=assignments,
        permissions=permissions or set(),
    )


def token(property_id):
    return Principal(id=str(uuid4()), property_id=str(property_id), role="gm", permissions={Perm.USERS_WRITE})


def test_internal_roles_and_no_implicit_inheritance():
    assert set(DEFAULT_ROLE_PERMISSIONS) == {Role.OWNER, Role.GM, Role.MANAGER, Role.STAFF}
    assert Perm.ATTENDANCE_MARK not in DEFAULT_ROLE_PERMISSIONS[Role.GM]
    assert Perm.USERS_WRITE not in DEFAULT_ROLE_PERMISSIONS[Role.MANAGER]


def test_stale_role_and_permissions_are_replaced():
    branch, department = uuid4(), uuid4()
    principal = authorize_staff_principal(token(branch), DB(account("manager", branch, [department], permissions={Perm.TASKS_ASSIGN})))
    assert principal.role == "manager"
    assert principal.permissions == {Perm.TASKS_ASSIGN}
    assert not principal.can(Perm.USERS_WRITE)
    principal.require_department(department)
    with pytest.raises(HTTPException):
        principal.require_department(uuid4())


def test_revoked_branch_and_missing_department_fail_closed():
    branch = uuid4()
    for user in (account("manager", uuid4(), [uuid4()]), account("manager", branch, [])):
        with pytest.raises(HTTPException):
            authorize_staff_principal(token(branch), DB(user))


def test_guessed_object_id_cannot_cross_branch_or_department():
    branch, department = uuid4(), uuid4()
    principal = authorize_staff_principal(token(branch), DB(account("manager", branch, [department])))
    for obj in (SimpleNamespace(property_id=uuid4(), department_id=department),
                SimpleNamespace(property_id=branch, department_id=uuid4())):
        with pytest.raises(HTTPException):
            principal.require_object(obj)


def test_notification_backlog_requires_matching_department():
    branch, department = uuid4(), uuid4()
    principal = authorize_staff_principal(token(branch), DB(account("manager", branch, [department])))
    assert principal.can_see_event(department)
    assert not principal.can_see_event(uuid4())
    assert not principal.can_see_event(None)


def test_manager_with_multiple_departments_must_select_scope():
    branch, first, second = uuid4(), uuid4(), uuid4()
    principal = authorize_staff_principal(token(branch), DB(account("manager", branch, [first, second])))
    assert principal.scoped_department(first) == first
    assert principal.scoped_department(second) == second
    with pytest.raises(HTTPException):
        principal.scoped_department(None)


def test_deactivated_account_invalidates_access_token():
    branch = uuid4()
    with pytest.raises(HTTPException):
        authorize_staff_principal(token(branch), DB(account("staff", branch, [uuid4()], active=False)))


def test_revoked_refresh_session_cannot_mint_new_access(monkeypatch):
    monkeypatch.setattr(identity_service, "decode_token", lambda token, expect: {"sub": str(uuid4())})
    db = DB(SimpleNamespace(revoked_at=object(), expires_at=None))
    with pytest.raises(Exception, match="no longer valid"):
        identity_service.refresh(db, "old-refresh-token")
