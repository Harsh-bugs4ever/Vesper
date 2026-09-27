from uuid import uuid4
from types import SimpleNamespace

import pytest

from app.api.staff import service
from app.api.staff import events
from app.api.staff.models import Task, TaskStatus
from vesper_common.clock import utcnow
from vesper_common.errors import Conflict, Forbidden
from vesper_common.events import Envelope, Event


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


def test_stockout_creates_department_runner_task_for_zero_balance(monkeypatch):
    property_id, department_id, item_id, order_id = uuid4(), uuid4(), uuid4(), uuid4()
    item = SimpleNamespace(id=item_id, property_id=property_id, department_id=department_id, name="Towels")
    db = LockedTaskDB(item)
    drafts = []
    monkeypatch.setattr(events.service, "create_task", lambda db, property_id, draft, **kwargs: drafts.append(draft))
    envelope = Envelope(name=Event.STOCK_LOW.value, property_id=str(property_id), payload={
        "item_id": str(item_id), "purchase_order_id": str(order_id), "on_hand": 0,
    })
    events._task_from_stockout(db, envelope)
    assert len(drafts) == 1
    assert drafts[0].department_id == department_id
    assert drafts[0].source_ref == order_id
    assert drafts[0].meta["kind"] == "stockout_runner"

    envelope.payload["on_hand"] = 2
    events._task_from_stockout(db, envelope)
    assert len(drafts) == 1
