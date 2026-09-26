from uuid import uuid4

import pytest

from app.api.staff import service
from app.api.staff.models import Task, TaskStatus
from vesper_common.clock import utcnow
from vesper_common.errors import Conflict, Forbidden


class LockedTaskDB:
    def __init__(self, task):
        self.task = task
        self.commits = 0

    def scalars(self, query):
        return self

    def first(self):
        return self.task

    def commit(self):
        self.commits += 1

    def refresh(self, task):
        pass


def task():
    return Task(
        id=uuid4(), property_id=uuid4(), department_id=uuid4(),
        title="Guest request", status=TaskStatus.OPEN, created_at=utcnow(),
    )


def test_claim_is_idempotent_for_winner_and_conflicts_for_other_staff(monkeypatch):
    row = task()
    db = LockedTaskDB(row)
    first, second = uuid4(), uuid4()
    published = []
    monkeypatch.setattr(service.bus, "publish", lambda *args, **kwargs: published.append(args))

    service.claim_task(db, row.property_id, row.id, first, department_ids={row.department_id})
    service.claim_task(db, row.property_id, row.id, first, department_ids={row.department_id})
    with pytest.raises(Conflict):
        service.claim_task(db, row.property_id, row.id, second, department_ids={row.department_id})

    assert row.assignee_id == first
    assert row.status == TaskStatus.IN_PROGRESS
    assert db.commits == 1
    assert len(published) == 1


def test_locked_task_rechecks_department_and_pool_permission():
    row = task()
    db = LockedTaskDB(row)
    with pytest.raises(Forbidden):
        service.claim_task(db, row.property_id, row.id, uuid4(), department_ids={uuid4()})
    with pytest.raises(Forbidden):
        service.claim_task(db, row.property_id, row.id, uuid4(), department_ids={row.department_id}, can_claim_pool=False)
    assert db.commits == 0


def test_completion_is_idempotent_only_for_completing_staff(monkeypatch):
    row = task()
    winner, other = uuid4(), uuid4()
    row.assignee_id = winner
    row.status = TaskStatus.IN_PROGRESS
    db = LockedTaskDB(row)
    published = []
    monkeypatch.setattr(service.bus, "publish", lambda *args, **kwargs: published.append(args))

    service.update_status(db, row.property_id, row.id, TaskStatus.DONE,
                          actor_id=str(winner), department_ids={row.department_id})
    service.update_status(db, row.property_id, row.id, TaskStatus.DONE,
                          actor_id=str(winner), department_ids={row.department_id})
    with pytest.raises(Conflict):
        service.update_status(db, row.property_id, row.id, TaskStatus.DONE,
                              actor_id=str(other), department_ids={row.department_id})
    assert db.commits == 1
    assert len(published) == 1
