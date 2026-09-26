"""Focused contracts for room occupancy, property content and guest isolation."""
import asyncio
from importlib import import_module
from datetime import date, timedelta
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image
from starlette.datastructures import Headers

from app.api.frontdesk import service as frontdesk
from app.api.guest import service as guest
from app.api.guest import router as guest_router_module
from app.api.property import service as property_service
from app.api.property.models import ResortAmenity, RoomStatus
from app.api.property.schemas import PublicPropertyOut
from vesper_common.clock import utcnow
from vesper_common.errors import Conflict, Forbidden, Invalid
from vesper_common.permissions import Perm
from vesper_common.security import Principal

property_router_module = import_module("app.api.property.router")


def test_internal_service_can_resolve_guest_request_department(monkeypatch):
    property_id, department_id = uuid4(), uuid4()
    department = SimpleNamespace(id=department_id, key="housekeeping",
                                 name="Housekeeping", default_sla_minutes=30,
                                 head_user_id=None)
    monkeypatch.setattr(property_router_module.service, "list_departments",
                        lambda *_: [department])
    service = Principal(id="guest-service", property_id=str(property_id), role="service")
    rows = property_router_module.list_departments(service, MagicMock())
    assert [row.key for row in rows] == ["housekeeping"]


def test_occupied_room_can_be_dirty_and_still_count_as_occupied(monkeypatch):
    property_id, room_id = uuid4(), uuid4()
    room = SimpleNamespace(id=room_id, number="201", floor=2, status=RoomStatus.READY, notes=None,
                           status_changed_at=None, _occupied=True)
    db = MagicMock()
    db.scalars.return_value.first.return_value = room
    db.scalars.return_value.__iter__.return_value = iter([room_id])
    monkeypatch.setattr(property_service.bus, "publish", lambda *a, **k: None)
    property_service.set_room_status(db, property_id, room_id, RoomStatus.DIRTY)
    assert room.status == RoomStatus.DIRTY
    assert room._occupied is True
    db.commit.assert_called_once()


def test_check_in_rejects_room_with_active_stay(monkeypatch):
    property_id, booking_id, room_id, category_id = (uuid4() for _ in range(4))
    today = date(2026, 9, 26)
    booking = SimpleNamespace(status="confirmed", room_category_id=category_id,
                              check_in_date=today, check_out_date=today + timedelta(days=1))
    room = SimpleNamespace(id=room_id, property_id=property_id,
                           category_id=category_id, status="ready")
    db = MagicMock()
    db.scalars.return_value.first.side_effect = [booking, room, SimpleNamespace(id=uuid4())]
    monkeypatch.setattr(frontdesk, "local_today", lambda: today)
    with pytest.raises(Conflict, match="already occupied"):
        frontdesk.check_in(db, property_id, booking_id, room_id, actor_id="staff")
    db.commit.assert_not_called()


def test_check_in_opens_stay_without_overwriting_housekeeping(monkeypatch):
    property_id, booking_id, room_id, category_id = (uuid4() for _ in range(4))
    booking = SimpleNamespace(id=booking_id, guest_id=uuid4(), status="confirmed",
        room_category_id=category_id, total_amount=100, nights=2,
        check_in_date=date(2026, 9, 26), check_out_date=date(2026, 9, 28))
    room = SimpleNamespace(id=room_id, property_id=property_id, number="201",
        category_id=category_id, status=RoomStatus.READY)
    db = MagicMock()
    db.scalars.return_value.first.side_effect = [booking, room, None]
    monkeypatch.setattr(frontdesk, "local_today", lambda: date(2026, 9, 26))
    monkeypatch.setattr(frontdesk.bus, "publish", lambda *a, **k: None)
    stay = frontdesk.check_in(db, property_id, booking_id, room_id, actor_id="staff")
    assert stay.booking_id == booking_id
    assert booking.status == "checked_in"
    assert room.status == RoomStatus.OCCUPIED
    db.commit.assert_called_once()


def test_checkout_dirties_room_and_rotates_qr_in_stay_transaction(monkeypatch):
    property_id, stay_id, room_id = (uuid4() for _ in range(3))
    booking = SimpleNamespace(status="checked_in", nights=2)
    stay = SimpleNamespace(id=stay_id, status="in_house", booking=booking,
                           guest_id=uuid4(), room_id=room_id, room_number="201",
                           folio_total=100)
    room = SimpleNamespace(id=room_id, property_id=property_id, number="201", floor=2,
                           status="ready", qr_secret="old", status_changed_at=None)
    db = MagicMock()
    db.scalars.return_value.first.side_effect = [stay, room]
    monkeypatch.setattr(frontdesk, "record_visit", lambda *a, **k: None)
    monkeypatch.setattr(frontdesk.bus, "publish", lambda *a, **k: None)
    frontdesk.check_out(db, property_id, stay_id, actor_id="staff")
    assert stay.status == "checked_out"
    assert room.status == RoomStatus.DIRTY
    assert room.qr_secret != "old"
    db.commit.assert_called_once()


def test_amenity_availability_accounts_for_temporary_closure():
    amenity = ResortAmenity(is_available=True, closed_until=utcnow() + timedelta(hours=2))
    assert amenity.available_now is False
    amenity.closed_until = utcnow() - timedelta(minutes=1)
    assert amenity.available_now is True
    amenity.is_available = False
    assert amenity.available_now is False


def test_public_property_contract_excludes_operational_data():
    assert not {"total_rooms", "settings", "occupancy_rate", "occupied_rooms"} & set(
        PublicPropertyOut.model_fields
    )


def test_guest_token_cannot_read_another_room_and_image_upload_needs_editor(monkeypatch):
    property_id, room_id, other_room, stay_id, guest_id = (uuid4() for _ in range(5))
    monkeypatch.setattr(guest.frontdesk, "get", lambda *a, **k: {
        "status": "in_house", "property_id": str(property_id),
        "room_id": str(other_room), "guest_id": str(guest_id),
    })
    with pytest.raises(Forbidden):
        guest.assert_stay_open(str(stay_id), str(property_id), room_id=str(room_id))
    staff = Principal(id=str(uuid4()), property_id=str(property_id), role="staff",
                      permissions=frozenset())
    with pytest.raises(HTTPException) as denied:
        staff.require(Perm.PROPERTY_WRITE)
    assert denied.value.status_code == 403


def test_guest_room_response_omits_internal_notes_and_other_guests(monkeypatch):
    property_id, room_id = uuid4(), uuid4()
    room = SimpleNamespace(id=room_id, number="201", floor=2, notes="VIP issue",
        guest_id=uuid4(), category=SimpleNamespace(name="Suite", amenities=["Wi-Fi"]),
        images=[])
    monkeypatch.setattr(guest_router_module.property_service, "get_room", lambda *a: room)
    principal = Principal(id="stay", property_id=str(property_id), role="guest",
                          room_id=str(room_id))
    payload = guest_router_module.guest_room(principal, MagicMock()).model_dump()
    assert payload["number"] == "201"
    assert "notes" not in payload
    assert "guest_id" not in payload


def test_checked_out_stay_invalidates_guest_access(monkeypatch):
    property_id, stay_id = uuid4(), uuid4()
    monkeypatch.setattr(guest.frontdesk, "get", lambda *a, **k: {"status": "checked_out"})
    with pytest.raises(Forbidden, match="checked out"):
        guest.assert_stay_open(str(stay_id), str(property_id))


def test_room_upload_decodes_image_and_rejects_forged_content(monkeypatch, tmp_path):
    monkeypatch.setattr(property_router_module, "UPLOAD_DIR", tmp_path)
    invalid = UploadFile(filename="fake.png", file=BytesIO(b"not an image"),
                         headers=Headers({"content-type": "image/png"}))
    with pytest.raises(Invalid, match="valid JPEG, PNG or WebP"):
        asyncio.run(property_router_module._upload_image(invalid))
    output = BytesIO()
    Image.new("RGB", (8, 8), "blue").save(output, format="PNG")
    valid = UploadFile(filename="room.png", file=BytesIO(output.getvalue()),
                       headers=Headers({"content-type": "image/png"}))
    url, path = asyncio.run(property_router_module._upload_image(valid))
    assert url.startswith("/uploads/")
    with Image.open(path) as decoded:
        assert decoded.size == (8, 8)
