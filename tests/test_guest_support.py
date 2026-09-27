"""Stay and department isolation for support conversations."""

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.api.guest import support, support_router
from app.api.guest.schemas import SupportMessageWrite
from vesper_common.errors import NotFound
from vesper_common.security import Principal


def conversation(*, stay_id=None, department_id=None):
    return {
        "id": uuid4(), "stay_id": stay_id or uuid4(),
        "kind": "guest_support", "topic": "Towels", "urgency": "normal",
        "status": "open", "department_id": department_id or uuid4(),
        "created_at": datetime.now(timezone.utc),
        "assigned_owner_id": uuid4(),
        "posts": [
            {"id": uuid4(), "author_kind": "guest", "visibility": "guest",
             "body": "Towels, please", "created_at": datetime.now(timezone.utc)},
            {"id": uuid4(), "author_kind": "staff", "visibility": "internal",
             "body": "Internal handoff", "created_at": datetime.now(timezone.utc)},
        ],
    }


@pytest.mark.parametrize(("message", "department"), [
    ("Please send clean towels", "housekeeping"),
    ("Dinner is late", "fnb"),
    ("The shower is broken", "maintenance"),
    ("I feel unsafe", "security"),
    ("Towels and dinner are late", "front_office"),
    ("I have a complaint", "front_office"),
])
def test_support_handoff_routes_conservatively(message, department):
    assert support.support_department(message) == department


def test_guest_can_only_read_own_stay_and_guest_visible_posts(monkeypatch):
    stay_id = uuid4()
    own = conversation(stay_id=stay_id)
    other = conversation()
    guest = Principal(id="guest", property_id=str(uuid4()), role="guest",
                      stay_id=str(stay_id))
    monkeypatch.setattr(support_router.support, "get_conversation",
                        lambda _db, _property_id, conversation_id: own if conversation_id == own["id"] else other)

    visible = support_router.guest_get_conversation(own["id"], guest, MagicMock())
    assert visible.assigned_owner_id is None
    assert [post.body for post in visible.posts] == ["Towels, please"]
    with pytest.raises(NotFound):
        support_router.guest_get_conversation(other["id"], guest, MagicMock())


def test_guest_cannot_post_to_other_stay(monkeypatch):
    item = conversation()
    guest = Principal(id="guest", property_id=str(uuid4()), role="guest",
                      stay_id=str(uuid4()))
    add_post = MagicMock()
    monkeypatch.setattr(support_router.support, "get_conversation", lambda *_: item)
    monkeypatch.setattr(support_router.support, "add_post", add_post)

    with pytest.raises(NotFound):
        support_router.guest_post_message(item["id"], SupportMessageWrite(body="hello"), guest, MagicMock())
    add_post.assert_not_called()


def test_staff_cannot_read_or_resolve_another_department(monkeypatch):
    item = conversation()
    staff = Principal(id=str(uuid4()), property_id=str(uuid4()), role="staff",
                      department_ids={str(uuid4())})
    resolve = MagicMock()
    monkeypatch.setattr(support_router.support, "get_conversation", lambda *_: item)
    monkeypatch.setattr(support_router.support, "resolve_conversation", resolve)

    with pytest.raises(NotFound):
        support_router.staff_get_conversation(item["id"], staff, MagicMock())
    with pytest.raises(NotFound):
        support_router.staff_resolve_conversation(item["id"], staff, MagicMock())
    resolve.assert_not_called()
