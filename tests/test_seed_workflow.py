"""The demo story pack must be additive, repeatable and scoped to the demo."""
from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4
from decimal import Decimal
from contextlib import nullcontext
from importlib import import_module
import sys
import types

import pytest

from scripts.seed_workflow import scenario_id, seed_workflow


class FakeSession:
    def __init__(self, *, demo: bool = True):
        self.property_id = uuid4()
        self.property = SimpleNamespace(id=self.property_id,
            name="JW Marriott Mumbai, Juhu" if demo else "Real Resort",
            timezone="Asia/Kolkata", currency="INR")
        self.departments = [SimpleNamespace(id=uuid4(), key=key, head_user_id=uuid4())
            for key in ("front_office", "housekeeping", "fnb", "maintenance", "store")]
        self.users = [SimpleNamespace(id=uuid4(), email=email) for email in (
            "gm@vesper.demo", "fom@vesper.demo", "exec@vesper.demo",
            "chef@vesper.demo", "hk1@vesper.demo", "chiefeng@vesper.demo",
            "store@vesper.demo", "fnb1@vesper.demo", "front_office1@vesper.demo")]
        self.stock_items = [SimpleNamespace(id=uuid4(), sku=sku, unit_cost=Decimal("10"))
            for sku in ("LN-TOWEL", "TL-DENTAL", "FD-EGGS", "FD-BREAD", "SP-AC")]
        self.stays = [SimpleNamespace(id=uuid4(), room_id=uuid4(), room_number=str(201 + n),
            guest_id=uuid4()) for n in range(3)]
        self.rows = {}
        self.commits = 0

    def get(self, model, row_id):
        if model.__name__ == "Property" and row_id == self.property_id:
            return self.property
        return self.rows.get((model, row_id))

    def scalars(self, statement):
        model = statement.column_descriptions[0]["entity"]
        return iter({"Department": self.departments, "User": self.users,
            "Stay": self.stays, "StockItem": self.stock_items}.get(model.__name__, []))

    def scalar(self, statement):
        model = statement.column_descriptions[0]["entity"]
        if model.__name__ == "User":
            return self.users[0].id
        return None

    def add(self, row):
        self.rows[(type(row), row.id)] = row

    def flush(self):
        pass

    def commit(self):
        self.commits += 1


def test_preview_has_no_writes_and_apply_is_repeatable():
    db = FakeSession()
    preview = seed_workflow(db, db.property_id)
    assert preview["would_create"] >= 15
    assert db.rows == {}
    assert db.commits == 0

    first = seed_workflow(db, db.property_id, apply=True)
    assert first["created"] == preview["would_create"]
    assert len(db.rows) == first["created"]
    second = seed_workflow(db, db.property_id, apply=True)
    assert second["created"] == 0
    assert second["already_present"] == first["created"]


def test_non_demo_property_is_rejected():
    db = FakeSession(demo=False)
    with pytest.raises(ValueError, match="restricted to the synthetic resort"):
        seed_workflow(db, db.property_id, apply=True)
    assert not db.rows
    assert db.commits == 0


def test_staff_tasks_and_requisitions_are_linked_to_seeded_people_and_stock():
    from app.api.inventory.models import InventoryRequest, InventoryRequestAudit, InventoryRequestLine
    from app.api.staff.models import Task, TaskStatus

    db = FakeSession()
    result = seed_workflow(db, db.property_id, apply=True)
    assert "task:linen-pool" in result["new_keys"]
    assert "requisition:housekeeping" in result["new_keys"]

    tasks = [row for (model, _), row in db.rows.items() if model is Task]
    requests = [row for (model, _), row in db.rows.items() if model is InventoryRequest]
    lines = [row for (model, _), row in db.rows.items() if model is InventoryRequestLine]
    audits = [row for (model, _), row in db.rows.items() if model is InventoryRequestAudit]
    assert any(task.status == TaskStatus.OPEN and task.assignee_id is None for task in tasks)
    assert any(task.status == TaskStatus.IN_PROGRESS and task.assignee_id for task in tasks)
    assert len(requests) == 4  # three staff requests plus the existing demo special
    assert len(lines) == 6
    assert len(audits) == 3
    assert all(request.property_id == db.property_id and request.status == "submitted"
               for request in requests)
    assert {line.item_id for line in lines}.issubset({item.id for item in db.stock_items}
            | {scenario_id(db.property_id, "stock:special")})


def test_scenario_ids_are_stable_and_property_scoped():
    property_id = uuid4()
    assert scenario_id(property_id, "guest:housekeeping") == scenario_id(property_id, "guest:housekeeping")
    assert scenario_id(property_id, "guest:housekeeping") != scenario_id(uuid4(), "guest:housekeeping")


def test_workflow_reuses_models_loaded_by_base_seed(monkeypatch):
    package = types.ModuleType("vesper_models")
    package.__path__ = []
    monkeypatch.setitem(sys.modules, "vesper_models", package)
    for name in ("action", "frontdesk", "guest", "guest_intel", "identity",
                 "inventory", "maintenance", "property", "staff", "workforce"):
        module = import_module(f"app.api.{name}.models")
        monkeypatch.setitem(sys.modules, f"vesper_models.{name}", module)
        setattr(package, name, module)

    db = FakeSession()
    result = seed_workflow(db, db.property_id)
    assert result["would_create"] >= 35
    assert db.rows == {}


def test_list_properties_explains_empty_database(monkeypatch, capsys):
    workflow = import_module("scripts.seed_workflow")
    db = SimpleNamespace(scalars=lambda statement: [])
    monkeypatch.setattr(workflow, "session_scope", lambda: nullcontext(db))
    monkeypatch.setattr(sys, "argv", ["seed_workflow.py", "--list-properties"])

    assert workflow.main() == 1
    assert "No properties found" in capsys.readouterr().out
