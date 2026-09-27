"""The base seed stays one-command and its food orders have real links."""
from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from importlib import import_module
from types import SimpleNamespace
import sys
import types
from uuid import uuid4

import pytest

from scripts import seed, seed_fnb, seed_workflow
from scripts.seed_existing import enrich_existing_demo
from scripts.seed_staff_tasks import seed_claimable_work, seed_staff_tasks
from vesper_common.clock import property_tz, utcnow


def _app_model_aliases(monkeypatch):
    """Reuse app models so this unit test does not register SQLAlchemy tables twice."""
    package = types.ModuleType("vesper_models")
    package.__path__ = []
    monkeypatch.setitem(sys.modules, "vesper_models", package)
    for name in ("property", "identity", "frontdesk", "guest", "inventory", "staff"):
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
    monkeypatch.setattr(seed, "_load_ai_content",
                        lambda **kwargs: calls.append("ai_content") or {"tasks": []})
    monkeypatch.setattr(seed, "_seed_existing_ai_tasks",
                        lambda db, pid, content: calls.append(("ai_tasks", pid)) or 0)
    from scripts import seed_existing
    from scripts import seed_inventory_reorder as reorder_module
    from scripts import seed_staff_tasks as assignments_module
    monkeypatch.setattr(seed_existing, "enrich_existing_demo",
                        lambda db, pid: calls.append(("enrich", pid)) or
                        {"attendance_added": 0, "food_tasks_added": 0,
                         "stock_items_added": 0, "recipes_completed": 0})
    monkeypatch.setattr(assignments_module, "seed_staff_tasks",
                        lambda db, pid: calls.append(("assign", pid)) or
                        {"staff_accounts": 6, "tasks_added": 6, "already_present": 0})
    monkeypatch.setattr(assignments_module, "seed_claimable_work",
                        lambda db, pid: calls.append(("pool", pid)) or
                        {"claimable_added": 36, "already_present": 0,
                         "pool_grants_added": 0})
    monkeypatch.setattr(seed_workflow, "seed_workflow",
                        lambda db, pid, *, apply: calls.append((pid, apply)) or
                        {"created": 0, "already_present": 35})
    monkeypatch.setattr(reorder_module, "seed_inventory_reorder",
                        lambda db, pid: calls.append(("reorder", pid)) or
                        {"consumption_movements": 0, "reorder_suggestions": 0})
    monkeypatch.setattr(seed.sys, "argv", ["seed.py"])

    assert seed.main() == 0
    assert calls == ["ai_content", ("enrich", property_id), ("assign", property_id),
                     ("pool", property_id),
                     (property_id, True), ("reorder", property_id), ("ai_tasks", property_id)]
    assert "No base data was reset" in capsys.readouterr().out


def test_reset_requires_explicit_confirmation_before_database_access(monkeypatch, capsys):
    monkeypatch.setattr(seed.sys, "argv", ["seed.py", "--reset"])
    monkeypatch.setattr(seed, "get_engine", lambda: pytest.fail("database was accessed"))
    with pytest.raises(SystemExit, match="2"):
        seed.main()
    assert "drops every Vesper schema" in capsys.readouterr().err


def test_every_demo_staff_member_gets_one_scoped_assigned_task(monkeypatch):
    _app_model_aliases(monkeypatch)
    from vesper_models.staff import Task, TaskStatus

    property_id = uuid4()
    role = SimpleNamespace(id=uuid4())
    departments = [SimpleNamespace(id=uuid4(), key=key) for key in
        ("housekeeping", "fnb", "front_office", "maintenance", "store", "security")]
    users = [SimpleNamespace(id=uuid4(), department_id=department.id,
                             email=f"{department.key}1@vesper.demo")
             for department in departments]
    room = SimpleNamespace(id=uuid4(), number="401")
    stock = SimpleNamespace(id=uuid4(), sku="LN-TOWEL", name="Bath Towels")

    class Session:
        def __init__(self):
            self.tasks = {}

        def get(self, model, row_id):
            if model.__name__ == "Property":
                return SimpleNamespace(name="JW Marriott Mumbai, Juhu")
            return self.tasks.get(row_id)

        def scalar(self, statement):
            return role

        def scalars(self, statement):
            model = statement.column_descriptions[0]["entity"]
            return {"Department": departments, "User": users,
                    "Room": [room], "StockItem": [stock]}.get(model.__name__, [])

        def add(self, task):
            self.tasks[task.id] = task

    db = Session()
    first = seed_staff_tasks(db, property_id)
    second = seed_staff_tasks(db, property_id)
    assert first == {"staff_accounts": 6, "tasks_added": 6, "already_present": 0}
    assert second == {"staff_accounts": 6, "tasks_added": 0, "already_present": 6}
    assert len(db.tasks) == 6
    for user in users:
        task = next(task for task in db.tasks.values() if task.assignee_id == user.id)
        assert isinstance(task, Task)
        assert task.property_id == property_id
        assert task.department_id == user.department_id
        assert task.status == TaskStatus.ASSIGNED
        assert task.title and task.description and task.due_at


def test_claimable_work_is_open_and_scoped_to_demo_departments(monkeypatch):
    _app_model_aliases(monkeypatch)
    from vesper_models.staff import TaskStatus

    property_id = uuid4()
    departments = [SimpleNamespace(id=uuid4(), key=key) for key in
        ("housekeeping", "fnb", "front_office", "maintenance", "store", "security")]
    users = [SimpleNamespace(id=uuid4(), department_id=department.id,
                             extra_permissions=["tasks:pool_read"] if index < 4 else [],
                             email=f"{department.key}1@vesper.demo")
             for index, department in enumerate(departments)]
    rooms = [SimpleNamespace(id=uuid4(), number=str(401 + index)) for index in range(6)]

    class Session:
        def __init__(self):
            self.tasks = {}

        def get(self, model, row_id):
            if model.__name__ == "Property":
                return SimpleNamespace(name="JW Marriott Mumbai, Juhu")
            return self.tasks.get(row_id)

        def scalar(self, statement):
            return SimpleNamespace(id=uuid4())

        def scalars(self, statement):
            model = statement.column_descriptions[0]["entity"]
            return {"Department": departments, "User": users, "Room": rooms}.get(model.__name__, [])

        def add(self, task):
            self.tasks[task.id] = task

    db = Session()
    assert seed_claimable_work(db, property_id) == {
        "claimable_added": 36, "already_present": 0, "pool_grants_added": 2}
    assert seed_claimable_work(db, property_id) == {
        "claimable_added": 0, "already_present": 36, "pool_grants_added": 0}
    assert len(db.tasks) == 36
    assert all("tasks:pool_read" in user.extra_permissions for user in users)
    authorized_ids = {department.id for department in departments}
    assert all(task.property_id == property_id and task.department_id in authorized_ids
               and task.assignee_id is None and task.status == TaskStatus.OPEN
               and task.title and task.description and task.due_at
               for task in db.tasks.values())


def test_standalone_staff_seeder_commits_assignments(monkeypatch, capsys):
    _app_model_aliases(monkeypatch)
    from scripts import seed_staff_tasks as assignments_module

    property_id = uuid4()
    calls = []

    class Session:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def scalars(self, statement):
            return [property_id]

        def commit(self):
            calls.append("commit")

    monkeypatch.setattr(assignments_module, "import_all_models", lambda root: None)
    monkeypatch.setattr(assignments_module, "session_scope", Session)
    monkeypatch.setattr(assignments_module, "seed_staff_tasks",
                        lambda db, pid: calls.append(pid) or
                        {"staff_accounts": 184, "tasks_added": 184, "already_present": 0})
    monkeypatch.setattr(assignments_module, "seed_claimable_work",
                        lambda db, pid: calls.append("pool") or
                        {"claimable_added": 36, "already_present": 0,
                         "pool_grants_added": 0})
    monkeypatch.setattr(assignments_module.sys, "argv", ["seed_staff_tasks.py"])

    assert assignments_module.main() == 0
    assert calls == [property_id, "pool", "commit"]
    assert "tasks_added       184" in capsys.readouterr().out


def test_existing_demo_enrichment_is_repeatable(monkeypatch):
    _app_model_aliases(monkeypatch)
    today = utcnow().astimezone(property_tz()).date()
    property_id = uuid4()
    role = SimpleNamespace(id=uuid4())
    shift = SimpleNamespace(id=uuid4())
    department = SimpleNamespace(id=uuid4())
    user = SimpleNamespace(id=uuid4(), department_id=department.id)
    stay = SimpleNamespace(id=uuid4())
    request = SimpleNamespace(id=uuid4(), department_id=department.id,
        accepted_by=None, room_id=uuid4(), room_number="401", note="Bring tea",
        status="raised", due_at=utcnow() + timedelta(minutes=30),
        accepted_at=None, delivered_at=None, items=[{"name": "Masala Chai"}],
        created_at=utcnow())
    menu = SimpleNamespace(recipe={})

    class Session:
        def __init__(self):
            self.attendance = []
            self.tasks = []
            self.stock = []

        def get(self, model, row_id):
            return SimpleNamespace(name="JW Marriott Mumbai, Juhu", timezone="Asia/Kolkata")

        def scalar(self, statement):
            name = statement.column_descriptions[0]["entity"].__name__
            return {"Role": role, "Shift": shift, "Department": department,
                    "StockItem": self.stock[0] if self.stock else None}[name]

        def scalars(self, statement):
            desc = statement.column_descriptions[0]
            name = desc["entity"].__name__
            if name == "Task" and desc["name"] == "source_ref":
                return [task.source_ref for task in self.tasks]
            return {
                "User": [user], "Attendance": self.attendance,
                "Stay": [stay], "ServiceRequest": [request],
                "MenuItem": [menu],
            }.get(name, [])

        def add(self, row):
            if type(row).__name__ == "Attendance":
                self.attendance.append(row)
            elif type(row).__name__ == "Task":
                self.tasks.append(row)
            elif type(row).__name__ == "StockItem":
                self.stock.append(row)

        def flush(self):
            for row in self.stock:
                if row.id is None:
                    row.id = uuid4()

    db = Session()
    first = enrich_existing_demo(db, property_id)
    second = enrich_existing_demo(db, property_id)
    assert first == {"attendance_added": 5, "food_tasks_added": 1,
                     "historical_orders_repaired": 0, "historical_orders_unmatched": 0,
                     "stock_items_added": 1, "recipes_completed": 1}
    assert second == {key: 0 for key in first}
    assert db.tasks[0].source_ref == request.id
    assert db.tasks[0].assignee_id is None
    assert menu.recipe == {str(db.stock[0].id): 0.08}


def test_legacy_food_order_repairs_only_a_unique_booking(monkeypatch):
    _app_model_aliases(monkeypatch)
    category_id = uuid4()
    guest_id = uuid4()
    property_id = uuid4()
    check_in_date = utcnow().astimezone(property_tz()).date() - timedelta(days=3)
    request = SimpleNamespace(id=uuid4(), guest_id=guest_id,
        room_id=category_id, room_number="Room-999", stay_id=uuid4(),
        total_amount=Decimal("560"),
        created_at=datetime.combine(check_in_date, time(17),
                                    tzinfo=property_tz()).astimezone(timezone.utc))
    room = SimpleNamespace(id=uuid4(), category_id=category_id, number="402")
    booking = SimpleNamespace(id=uuid4(), guest_id=guest_id,
        room_category_id=category_id, check_in_date=check_in_date,
        check_out_date=check_in_date + timedelta(days=2),
        total_amount=Decimal("12000"), room_id=None)
    visit = SimpleNamespace(stay_id=None, outlet=None, meta={})

    class Session:
        stay = None

        def get(self, model, row_id):
            return SimpleNamespace(name="JW Marriott Mumbai, Juhu", timezone="Asia/Kolkata")

        def scalar(self, statement):
            name = statement.column_descriptions[0]["entity"].__name__
            return {
                "Role": SimpleNamespace(id=uuid4()),
                "Shift": SimpleNamespace(id=uuid4()),
                "Stay": self.stay,
                "StockItem": SimpleNamespace(id=uuid4()),
            }[name]

        def scalars(self, statement):
            name = statement.column_descriptions[0]["entity"].__name__
            return {
                "User": [], "Attendance": [], "Stay": [],
                "ServiceRequest": [request], "Room": [room],
                "Booking": [booking], "GuestVisit": [visit],
                "MenuItem": [],
            }.get(name, [])

        def add(self, row):
            if type(row).__name__ == "Stay":
                self.stay = row

    db = Session()
    first = enrich_existing_demo(db, property_id)
    second = enrich_existing_demo(db, property_id)
    assert first["historical_orders_repaired"] == 1
    assert first["historical_orders_unmatched"] == 0
    assert second["historical_orders_repaired"] == 0
    assert request.stay_id == db.stay.id
    assert request.room_id == room.id
    assert request.room_number == room.number
    assert booking.room_id == room.id
    assert visit.stay_id == db.stay.id
    assert visit.meta["request_id"] == str(request.id)


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
