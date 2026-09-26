"""Support routing, persisted handoff and shared message visibility contracts."""
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.api.guest import support
from app.api.guest.support_router import _view
from app.api.notification.service import can_receive
from app.api.staff import service as staff_service
from app.api.staff.models import TaskSource
from vesper_common.errors import Conflict, NotFound
from vesper_common.security import Principal


@pytest.mark.parametrize(("question", "department", "reason"), [
    ("Please send towels", "housekeeping", "service_request"),
    ("I'd like food sent to my room", "fnb", "service_request"),
    ("The shower is broken", "maintenance", "service_request"),
    ("I need help with my booking", "front_office", "service_request"),
    ("Please send towels and food", "front_office", "ambiguous_request"),
    ("Can I speak to a person?", "front_office", "human_requested"),
    ("This is a complaint", "front_office", "complaint"),
    ("When does the pool open?", None, None),
])
def test_deterministic_routing(question, department, reason):
    route = support.classify(question)
    assert (route.department_key, route.reason) == (department, reason)


def test_provider_failure_persists_human_handoff(monkeypatch):
    property_id, stay_id, room_id, department_id, request_id = (uuid4() for _ in range(5))
    db = MagicMock()
    department = SimpleNamespace(id=department_id, name="Front Desk", default_sla_minutes=30)
    monkeypatch.setattr(support, "_department", lambda *_: department)
    monkeypatch.setattr(support, "_manager", lambda *_: None)
    monkeypatch.setattr(support.intelligence, "ask", lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("offline")))
    monkeypatch.setattr(support.guest_service, "create_request", lambda *_a, **_k: SimpleNamespace(id=request_id))
    monkeypatch.setattr(support.bus, "publish", lambda *_a, **_k: None)
    result = support.ask_guest(db, property_id=property_id, stay_id=stay_id,
        guest_id=None, room_id=room_id, room_number="101", question="When does the pool open?")
    conversation, guest_post = db.add_all.call_args.args[0]
    assert db.commit.call_count >= 3
    assert guest_post.body == "When does the pool open?"
    assert conversation.request_id == request_id
    assert conversation.status == "escalated"
    assert result.escalated is True
    assert "sent to Front Desk" in result.answer


def test_duplicate_submission_returns_prior_answer(monkeypatch):
    prior = SimpleNamespace(id=uuid4())
    monkeypatch.setattr(support, "_prior_answer", lambda *_: prior)
    db = MagicMock()
    result = support.ask_guest(db, property_id=uuid4(), stay_id=uuid4(),
        guest_id=None, room_id=uuid4(), room_number="101", question="Towels please",
        client_message_id=uuid4())
    assert result is prior
    db.add_all.assert_not_called()


def test_duplicate_request_event_reuses_task():
    existing = SimpleNamespace(id=uuid4())
    db = MagicMock()
    db.scalars.return_value.first.return_value = existing
    draft = SimpleNamespace(source=TaskSource.GUEST_REQUEST, source_ref=uuid4())
    assert staff_service.create_task(db, uuid4(), draft) is existing
    db.add.assert_not_called()
    db.commit.assert_not_called()


def test_conversation_and_live_event_privacy(monkeypatch):
    property_id, stay_id, other_stay, department_id, owner_id = (uuid4() for _ in range(5))
    conv = SimpleNamespace(id=uuid4(), property_id=property_id, stay_id=stay_id,
        kind="guest", topic="housekeeping", urgency="normal", status="escalated",
        department_id=department_id, escalation_reason="service_request",
        assigned_owner_id=owner_id, request_id=uuid4(), acknowledged_at=None,
        resolved_at=None, created_at=support.utcnow())
    guest = Principal(id="guest", property_id=str(property_id), role="guest",
        stay_id=str(stay_id))
    other = Principal(id="guest", property_id=str(property_id), role="guest",
        stay_id=str(other_stay))
    support.require_guest_scope(guest, conv)
    with pytest.raises(NotFound):
        support.require_guest_scope(other, conv)
    monkeypatch.setattr(support, "visible_posts", lambda _db, _conv, *, guest: [] if guest else ["internal"])
    view = _view(MagicMock(), conv, guest=True)
    assert view.assigned_owner_id is None
    assert view.posts == []
    manager = Principal(id=str(owner_id), property_id=str(property_id), role="manager",
        department_ids={str(department_id)})
    outsider = Principal(id=str(uuid4()), property_id=str(property_id), role="manager",
        department_ids={str(department_id)})
    assert can_receive(manager, {"participant_ids": [str(owner_id)],
                                 "department_id": str(department_id), "visibility": "internal"})
    assert not can_receive(outsider, {"participant_ids": [str(owner_id)],
                                      "department_id": str(department_id), "visibility": "internal"})
    assert not can_receive(outsider, {"department_id": str(department_id),
        "recipient_ids": [str(owner_id)]})
