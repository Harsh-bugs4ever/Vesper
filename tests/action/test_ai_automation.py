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
    property_id = uuid4()
    db = MagicMock()
    # Mock in_house_stays = 12
    db.scalar.return_value = 12
    # Mock department and existing card (None)
    db.scalars.return_value.first.return_value = None

    card = run_facility_utilization_check(db, property_id, facility_name="Badminton Pavilion")
    assert card is not None
    assert card.kind == CardKind.FACILITY_PROMO.value
    assert "Badminton" in card.title
    assert card.status == CardStatus.PENDING
    assert db.add.called
    assert db.commit.called


def test_guest_recovery_check():
    property_id = uuid4()
    db = MagicMock()
    # Mock overdue requests (none, so it synthesizes fallback card)
    db.scalars.return_value = []

    # When query for existing card happens
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = None
    db.scalars.side_effect = [[], mock_scalars]

    cards = run_guest_recovery_check(db, property_id)
    assert len(cards) >= 1
    assert cards[0].kind == CardKind.GUEST_RECOVERY.value
    assert "Recovery" in cards[0].title
    assert db.commit.called


def test_vision_room_audit():
    property_id = uuid4()
    room_id = uuid4()
    db = MagicMock()
    room = SimpleNamespace(id=room_id, property_id=property_id, number="304", status="dirty")
    db.get.return_value = room
    db.scalars.return_value.first.return_value = None

    result = run_vision_room_audit(db, property_id, room_id=room_id)
    assert result["success"] is True
    assert result["passed"] is True
    assert result["new_status"] == "clean"
    assert result["audit_score"] > 90.0
    assert db.commit.called


def test_kitchen_waste_rescue():
    property_id = uuid4()
    db = MagicMock()
    item = SimpleNamespace(id=uuid4(), property_id=property_id, name="Burrata Cheese", quantity=Decimal("4.5"), unit="kg")
    dept = SimpleNamespace(id=uuid4(), key="fnb")
    
    mock_dept_scalars = MagicMock()
    mock_dept_scalars.first.return_value = dept

    mock_existing_scalars = MagicMock()
    mock_existing_scalars.first.return_value = None

    db.scalars.side_effect = [
        mock_dept_scalars,
        [item],
        mock_existing_scalars,
    ]

    card = run_kitchen_waste_rescue(db, property_id)
    assert card is not None
    assert card.kind == CardKind.CHEF_SPECIAL.value
    assert "Burrata Cheese" in card.title
    assert db.add.called
    assert db.commit.called


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
