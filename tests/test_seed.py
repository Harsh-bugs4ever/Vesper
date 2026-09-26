"""The base seed stays one-command and its food orders have real links."""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from importlib import import_module
from types import SimpleNamespace
import sys
import types
from uuid import uuid4

import pytest

from scripts import seed, seed_fnb, seed_workflow
from vesper_common.clock import property_tz, utcnow


def _app_model_aliases(monkeypatch):
    """Reuse app models so this unit test does not register SQLAlchemy tables twice."""
    package = types.ModuleType("vesper_models")
    package.__path__ = []
    monkeypatch.setitem(sys.modules, "vesper_models", package)
    for name in ("property", "identity", "frontdesk", "guest", "staff"):
        model = import_module(f"app.api.{name}.models")
        monkeypatch.setitem(sys.modules, f"vesper_models.{name}", model)
        setattr(package, name, model)


def test_existing_demo_rerun_only_adds_missing_workflows(monkeypatch, capsys):
    _app_model_aliases(monkeypatch)
    property_id = uuid4()
    calls = []

    class Session:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def scalar(self, statement):
            return property_id

    monkeypatch.setattr(seed, "get_engine", lambda: object())
    monkeypatch.setattr(seed, "import_all_models", lambda root: None)
    monkeypatch.setattr(seed, "inspect", lambda engine: SimpleNamespace(has_table=lambda *a, **kw: True))
    monkeypatch.setattr(seed, "session_scope", Session)
    monkeypatch.setattr(seed, "_seed", lambda db: calls.append("base"))
    monkeypatch.setattr(seed_workflow, "seed_workflow",
                        lambda db, pid, *, apply: calls.append((pid, apply)) or
                        {"created": 0, "already_present": 35})
    monkeypatch.setattr(seed.sys, "argv", ["seed.py"])

    assert seed.main() == 0
    assert calls == [(property_id, True)]
    assert "No base data was reset" in capsys.readouterr().out


def test_reset_requires_explicit_confirmation_before_database_access(monkeypatch, capsys):
    monkeypatch.setattr(seed.sys, "argv", ["seed.py", "--reset"])
    monkeypatch.setattr(seed, "get_engine", lambda: pytest.fail("database was accessed"))
    with pytest.raises(SystemExit, match="2"):
        seed.main()
    assert "drops every Vesper schema" in capsys.readouterr().err


class Rows:
    def __init__(self, rows):
        self.rows = rows

    def __iter__(self):
        return iter(self.rows)

    def first(self):
        return self.rows[0] if self.rows else None


class FoodSession:
    def __init__(self, *, historical: bool):
        self.property_id = uuid4()
        self.resort = SimpleNamespace(id=self.property_id)
        self.department = SimpleNamespace(id=uuid4())
        self.chef = SimpleNamespace(id=uuid4())
        self.room = SimpleNamespace(id=uuid4(), category_id=uuid4(), number="401")
        self.active_stays = [SimpleNamespace(id=uuid4(), room_id=uuid4(),
            room_number=str(401 + index), guest_id=uuid4()) for index in range(11)]
        today = utcnow().astimezone(property_tz()).date()
        self.booking = SimpleNamespace(id=uuid4(), property_id=self.property_id,
            room_category_id=self.room.category_id, guest_id=uuid4(), room_id=None,
            check_in_date=today - timedelta(days=3),
            check_out_date=today - timedelta(days=1), total_amount=Decimal("12000"))
        self.menu = [SimpleNamespace(id=uuid4(), name="Masala Chai", price=Decimal("280"))]
        self.historical = historical
        self.added = []
        self.commits = 0

    def get(self, model, row_id):
        return self.resort if model.__name__ == "Property" and row_id == self.property_id else None

    def scalars(self, statement):
        model = statement.column_descriptions[0]["entity"]
        rows = {
            "Department": [self.department], "User": [self.chef],
            "MenuItem": self.menu, "Stay": self.active_stays,
            "Booking": [self.booking] if self.historical else [],
            "Room": [self.room],
        }
        return Rows(rows.get(model.__name__, []))

    def add(self, row):
        self.added.append(row)

    def commit(self):
        self.commits += 1


def test_food_orders_have_staff_tasks_and_real_historical_stays(monkeypatch):
    _app_model_aliases(monkeypatch)
    monkeypatch.setattr(seed_fnb, "import_all_models", lambda root: None)
    from vesper_models.frontdesk import GuestVisit, Stay
    from vesper_models.guest import ServiceRequest
    from vesper_models.staff import Task, TaskStatus

    db = FoodSession(historical=True)
    monkeypatch.setattr(seed_fnb.random, "random", lambda: 0.0)
    counts = seed_fnb.seed_fnb_data(db, property_id=db.property_id)
    active_stay_ids = {stay.id for stay in db.active_stays}
    active_requests = [row for row in db.added if isinstance(row, ServiceRequest)
                       and row.stay_id in active_stay_ids]
    tasks = [row for row in db.added if isinstance(row, Task)]
    historical_stays = [row for row in db.added if isinstance(row, Stay)]
    historical_requests = [row for row in db.added if isinstance(row, ServiceRequest)
                           and row.stay_id not in active_stay_ids]
    visits = [row for row in db.added if isinstance(row, GuestVisit)]

    assert counts["fnb_tasks"] == len(active_requests) == len(tasks) == 11
    assert {task.source_ref for task in tasks} == {request.id for request in active_requests}
    assert {task.status for task in tasks} == {
        TaskStatus.OPEN, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, TaskStatus.DONE,
    }
    assert all(task.assignee_id is None for task in tasks if task.status == TaskStatus.OPEN)
    assert all(task.completed_at and task.completed_by for task in tasks
               if task.status == TaskStatus.DONE)
    assert all(request.note for request in active_requests)
    assert counts["fnb_historical_stays"] == len(historical_stays) == 1
    assert len(historical_requests) == 1
    assert historical_requests[0].stay_id == historical_stays[0].id
    assert historical_requests[0].room_id == db.room.id
    assert historical_requests[0].room_number == db.room.number
    assert db.booking.room_id == db.room.id
    assert all(visit.stay_id and visit.outlet == "In-room dining" and
               visit.meta["request_id"] != "None" for visit in visits)
    assert db.commits == 1
