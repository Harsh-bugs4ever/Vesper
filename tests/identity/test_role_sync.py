"""Keeping the shipped roles in step with the code.

The permission matrix lives in two places: `vesper_common.permissions` is what the code
checks, and the `identity.roles` rows are what a deployment actually grants. They have to
agree, and the sync is what makes them agree.

The bug this was written for: adding `maintenance:run` to the manager role in code
reached nobody on an already-seeded database, because the sync skipped any role that
already existed. The endpoint 403'd for exactly the role meant to have it.
"""
from __future__ import annotations

from uuid import uuid4

import pytest

from app.api.identity import service
from vesper_common.permissions import DEFAULT_ROLE_PERMISSIONS


class FakeRole:
    """Stands in for the ORM row; only the fields the sync touches."""

    def __init__(self, key: str, permissions: list[str], is_system: bool = True) -> None:
        self.key = key
        self.permissions = permissions
        self.is_system = is_system
        self.label = key.title()


class FakeSession:
    def __init__(self, existing: list[FakeRole]) -> None:
        self.existing = existing
        self.added: list[object] = []
        self.commits = 0

    def add(self, row) -> None:
        self.added.append(row)

    def commit(self) -> None:
        self.commits += 1


@pytest.fixture
def patched(monkeypatch):
    """Route list_roles at our fake rows and capture what gets created."""

    def install(existing: list[FakeRole]) -> FakeSession:
        session = FakeSession(existing)
        monkeypatch.setattr(service, "list_roles", lambda db, pid: db.existing)
        monkeypatch.setattr(service, "Role", _RecordingRole)
        return session

    return install


class _RecordingRole:
    def __init__(self, **kwargs) -> None:
        self.__dict__.update(kwargs)


def test_an_empty_database_gets_every_shipped_role(patched):
    session = patched([])
    service.ensure_default_roles(session, uuid4())

    created = {r.key for r in session.added}
    assert created == {str(k) for k in DEFAULT_ROLE_PERMISSIONS}
    assert all(r.is_system for r in session.added)


def test_a_new_permission_reaches_an_existing_system_role(patched):
    """The actual bug: the role exists, so it used to be skipped entirely."""
    stale = FakeRole("manager", ["tasks:read"])
    session = patched([stale])
    service.ensure_default_roles(session, uuid4())

    expected = sorted(str(p) for p in DEFAULT_ROLE_PERMISSIONS["manager"])
    assert stale.permissions == expected
    assert "maintenance:run" in stale.permissions


def test_a_permission_removed_in_code_is_removed_from_the_role(patched):
    """The sync is two-way, or a revoked permission lingers in production forever."""
    bloated = FakeRole("employee", ["tasks:read", "rates:approve", "users:write"])
    session = patched([bloated])
    service.ensure_default_roles(session, uuid4())

    assert "rates:approve" not in bloated.permissions
    assert "users:write" not in bloated.permissions


def test_a_role_an_operator_edited_is_left_alone(patched):
    """`is_system` is the line between "ours to define" and "a human decided this"."""
    custom = FakeRole("night_auditor", ["bookings:read"], is_system=False)
    session = patched([custom])
    service.ensure_default_roles(session, uuid4())

    assert custom.permissions == ["bookings:read"]


def test_an_already_correct_role_is_not_rewritten(patched):
    correct = FakeRole("employee", sorted(str(p) for p in DEFAULT_ROLE_PERMISSIONS["employee"]))
    before = list(correct.permissions)
    session = patched([correct])
    service.ensure_default_roles(session, uuid4())

    assert correct.permissions == before
    # The other shipped roles are missing here, so they are created; this one is not.
    assert "employee" not in {r.key for r in session.added}


def test_permissions_are_stored_sorted(patched):
    """Stable ordering keeps the matrix diffable and the equality check meaningful."""
    session = patched([])
    service.ensure_default_roles(session, uuid4())
    for row in session.added:
        assert row.permissions == sorted(row.permissions)


def test_the_sync_is_idempotent(patched):
    """A second run over a fully-synced database creates and changes nothing."""
    session = patched([])
    service.ensure_default_roles(session, uuid4())
    created = [FakeRole(r.key, list(r.permissions)) for r in session.added]
    snapshot = {r.key: list(r.permissions) for r in created}

    second = patched(created)
    service.ensure_default_roles(second, uuid4())

    assert second.added == []
    assert {r.key: r.permissions for r in created} == snapshot
