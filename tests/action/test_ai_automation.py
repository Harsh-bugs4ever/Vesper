from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.api.action.ai_automation import (
    run_all_ai_automations,
    run_facility_utilization_check,
    run_guest_recovery_check,
    run_kitchen_waste_rescue,
    run_vision_room_audit,
)
from app.api.action.executors import _EXECUTORS, _UNDOERS
from app.api.action.models import ActionCard, CardKind, CardStatus, Urgency


def test_ai_automation_executors_registered():
    """Verify that all 4 AI automation card kinds are properly registered in executors and undoers."""
    for kind in [
        CardKind.FACILITY_PROMO.value,
        CardKind.GUEST_RECOVERY.value,
        CardKind.VISION_AUDIT.value,
        CardKind.CHEF_SPECIAL.value,
    ]:
        assert kind in _EXECUTORS
        assert kind in _UNDOERS


def test_ai_automation_executors_and_undoers_work():
    """Verify that calling the executors and undoers succeeds."""
    card = SimpleNamespace(
        id=uuid4(),
        property_id=uuid4(),
        payload={"test": "data"},
        adjustments={},
        undo_payload=None,
    )
    for kind in [
        CardKind.FACILITY_PROMO.value,
        CardKind.GUEST_RECOVERY.value,
        CardKind.VISION_AUDIT.value,
        CardKind.CHEF_SPECIAL.value,
    ]:
        exec_fn = _EXECUTORS[kind]
        res = exec_fn(card)
        assert "queued" in res

        undo_fn = _UNDOERS[kind]
        undo_res = undo_fn(card)
        assert undo_res.get("cancelled") is True


def test_facility_utilization_check():
    db = MagicMock()
    assert run_facility_utilization_check(db, uuid4()) is None
    db.add.assert_not_called()
    db.commit.assert_not_called()

def test_guest_recovery_check():
    db = MagicMock()
    db.scalars.return_value = []
    assert run_guest_recovery_check(db, uuid4()) == []
    db.add.assert_not_called()

def test_vision_room_audit():
    db = MagicMock()
    result = run_vision_room_audit(db, uuid4(), room_id=uuid4())
    assert result["success"] is False
    db.commit.assert_not_called()

def test_kitchen_waste_rescue():
    db = MagicMock()
    assert run_kitchen_waste_rescue(db, uuid4()) is None
    db.add.assert_not_called()
    db.commit.assert_not_called()

def test_run_all_ai_automations():
    property_id = uuid4()
    db = MagicMock()
    db.scalar.return_value = 5
    db.scalars.return_value.first.return_value = None

    results = run_all_ai_automations(db, property_id)
    assert "facility_promo" in results
    assert "guest_recovery" in results
    assert "vision_audit" in results
    assert "chef_special" in results
    assert "total_cards_active" in results
