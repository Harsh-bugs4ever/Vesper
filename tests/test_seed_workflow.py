"""The demo story pack must be additive, repeatable and scoped to the demo."""
from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

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
            "store@vesper.demo")]
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
            "Stay": self.stays}.get(model.__name__, []))

    def scalar(self, statement):
        model = statement.column_descriptions[0]["entity"]
        if model.__name__ == "User":
            return self.users[0].id
        return None

    def add(self, row):
        self.rows[(type(row), row.id)] = row

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


def test_scenario_ids_are_stable_and_property_scoped():
    property_id = uuid4()
    assert scenario_id(property_id, "guest:housekeeping") == scenario_id(property_id, "guest:housekeeping")
    assert scenario_id(property_id, "guest:housekeeping") != scenario_id(uuid4(), "guest:housekeeping")
