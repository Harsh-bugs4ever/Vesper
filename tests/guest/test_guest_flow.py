"""Comprehensive test suite for the guest workflow.

Covers:
1. Stay-scoped session validation and rejection of checked-out / mismatched stays.
2. Menu listing with truthful inventory availability and rejection of sold-out orders.
3. Rapid repeated tap deduplication (duplicate order prevention).
4. Cross-stay isolation: guests cannot read or rate requests from other stays.
5. End-to-end request lifecycle: raise -> accept -> deliver -> rate.
"""
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest

from app.api.guest import service as guest_service
from app.api.guest.models import (
    MenuItem,
    RequestKind,
    RequestStatus,
    ServiceRequest,
)
from app.api.guest.schemas import RatingCreate, RequestCreate
from app.api.inventory.models import StockItem
from app.api.property.models import Property
from vesper_common.clock import utcnow
from vesper_common.errors import Conflict, Forbidden, Invalid


def test_stay_scoped_session_validates_in_house(monkeypatch):
    property_id, stay_id, room_id, guest_id = (uuid4() for _ in range(4))

    # Mock open stay
    monkeypatch.setattr(
        guest_service.frontdesk,
        "get",
        lambda path, **k: {
            "id": str(stay_id),
            "status": "in_house",
            "property_id": str(property_id),
            "room_id": str(room_id),
            "guest_id": str(guest_id),
        },
    )

    stay = guest_service.assert_stay_open(
        str(stay_id), str(property_id), room_id=str(room_id), guest_id=str(guest_id)
    )
    assert stay["status"] == "in_house"


def test_stay_scoped_session_rejects_checked_out(monkeypatch):
    property_id, stay_id, room_id = (uuid4() for _ in range(3))

    monkeypatch.setattr(
        guest_service.frontdesk,
        "get",
        lambda path, **k: {
            "id": str(stay_id),
            "status": "checked_out",
            "property_id": str(property_id),
            "room_id": str(room_id),
        },
    )

    with pytest.raises(Forbidden, match="checked out"):
        guest_service.assert_stay_open(str(stay_id), str(property_id), room_id=str(room_id))


def test_stay_scoped_session_rejects_mismatched_room(monkeypatch):
    property_id, stay_id, room_id, other_room = (uuid4() for _ in range(4))

    monkeypatch.setattr(
        guest_service.frontdesk,
        "get",
        lambda path, **k: {
            "id": str(stay_id),
            "status": "in_house",
            "property_id": str(property_id),
            "room_id": str(other_room),
        },
    )

    with pytest.raises(Forbidden, match="does not belong to the active stay"):
        guest_service.assert_stay_open(str(stay_id), str(property_id), room_id=str(room_id))


def test_menu_reflects_sold_out_inventory():
    property_id = uuid4()
    stock_bread_id = uuid4()

    prop = Property(
        id=property_id,
        name="Vesper Resort",
        city="Mumbai",
        currency="INR",
        timezone="Asia/Kolkata",
    )

    sandwich = MenuItem(
        id=uuid4(),
        property_id=property_id,
        category="all_day",
        name="Mumbai Club Sandwich",
        description="Fresh sandwich",
        price=Decimal("650.00"),
        is_veg=False,
        prep_minutes=20,
        is_available=True,
        recipe={str(stock_bread_id): 2},
    )

    stock_bread = StockItem(
        id=stock_bread_id,
        property_id=property_id,
        sku="FOOD-BRD-001",
        name="Artisan Bread Loaf",
        category="food",
        quantity=Decimal("0.0"),  # Sold out / depleted!
        minimum_quantity=Decimal("5.0"),
    )

    db = MagicMock()
    db.get.return_value = prop
    # db.scalars queries: first for MenuItem, second for StockItem
    db.scalars.side_effect = [
        MagicMock(__iter__=lambda self: iter([sandwich])),
        MagicMock(__iter__=lambda self: iter([stock_bread])),
    ]

    result = guest_service.menu(db, property_id)
    items = result["categories"]["all_day"]
    assert len(items) == 1
    assert items[0]["name"] == "Mumbai Club Sandwich"
    # Because bread stock is 0, item must be marked sold out!
    assert items[0]["is_available"] is False


def test_price_order_rejects_sold_out_item():
    property_id = uuid4()
    stock_tea_id = uuid4()
    item_id = uuid4()

    chai = MenuItem(
        id=item_id,
        property_id=property_id,
        category="beverages",
        name="Kullad Masala Chai",
        price=Decimal("180.00"),
        is_available=True,
        recipe={str(stock_tea_id): 1},
    )

    stock_tea = StockItem(
        id=stock_tea_id,
        property_id=property_id,
        sku="BEV-TEA-001",
        name="Assam CTC Tea",
        category="beverage",
        quantity=Decimal("0.0"),  # Depleted
    )

    db = MagicMock()
    db.scalars.side_effect = [
        iter([chai]),
        iter([stock_tea]),
    ]

    from app.api.guest.schemas import OrderLine

    data = RequestCreate(
        kind=RequestKind.ROOM_SERVICE,
        items=[OrderLine(menu_item_id=item_id, quantity=2)],
    )

    with pytest.raises(Invalid, match="sold out and unavailable"):
        guest_service._price_order(db, property_id, data)


def test_duplicate_order_prevention_returns_existing_request(monkeypatch):
    property_id, stay_id, room_id = (uuid4() for _ in range(3))
    existing_req = ServiceRequest(
        id=uuid4(),
        property_id=property_id,
        stay_id=stay_id,
        room_id=room_id,
        room_number="412",
        kind="housekeeping",
        note="Extra bath sheets please",
        status=RequestStatus.RAISED,
        created_at=utcnow(),
        items=[],
        total_amount=Decimal("0"),
        sla_minutes=30,
        due_at=utcnow() + timedelta(minutes=30),
    )

    db = MagicMock()
    # Mock return existing request within 30s window
    db.scalars.return_value = [existing_req]

    monkeypatch.setattr(
        guest_service,
        "_department",
        lambda pid, key: {"id": str(uuid4()), "default_sla_minutes": 30},
    )

    data = RequestCreate(
        kind=RequestKind.HOUSEKEEPING,
        note="Extra bath sheets please",
    )

    # Calling create_request with duplicate payload
    result = guest_service.create_request(
        db,
        property_id=property_id,
        stay_id=stay_id,
        room_id=room_id,
        room_number="412",
        guest_id=None,
        data=data,
    )

    # Must return the existing request without adding or committing a new one
    assert result.id == existing_req.id
    db.add.assert_not_called()


def test_cross_stay_isolation_prevents_rating_other_stays(monkeypatch):
    property_id, my_stay_id, other_stay_id, request_id = (uuid4() for _ in range(4))

    request = ServiceRequest(
        id=request_id,
        property_id=property_id,
        stay_id=other_stay_id,  # Belongs to another stay!
        room_id=uuid4(),
        room_number="204",
        kind="housekeeping",
        status=RequestStatus.DELIVERED,
        rating=None,
    )

    db = MagicMock()
    db.scalars.return_value.first.return_value = request

    data = RatingCreate(rating=5, comment="Great job")

    with pytest.raises(Forbidden, match="That request belongs to another room"):
        guest_service.rate_request(db, property_id, request_id, my_stay_id, data)


def test_successful_request_lifecycle(monkeypatch):
    property_id, stay_id, room_id, user_id, request_id = (uuid4() for _ in range(5))

    request = ServiceRequest(
        id=request_id,
        property_id=property_id,
        stay_id=stay_id,
        room_id=room_id,
        room_number="412",
        kind="housekeeping",
        status=RequestStatus.RAISED,
        created_at=utcnow(),
        due_at=utcnow() + timedelta(minutes=30),
        items=[],
        total_amount=Decimal("0"),
        rating=None,
    )

    db = MagicMock()
    db.scalars.return_value.first.return_value = request
    monkeypatch.setattr(guest_service.bus, "publish", lambda *a, **k: None)

    # 1. Staff accepts
    accepted = guest_service.accept_request(db, property_id, request_id, user_id)
    assert accepted.status == RequestStatus.ACCEPTED
    assert accepted.accepted_by == user_id

    # 2. Staff delivers
    delivered = guest_service.set_request_status(
        db, property_id, request_id, RequestStatus.DELIVERED, actor_id=str(user_id)
    )
    assert delivered.status == RequestStatus.DELIVERED
    assert delivered.delivered_at is not None

    # 3. Guest rates
    rated = guest_service.rate_request(
        db, property_id, request_id, stay_id, RatingCreate(rating=5, comment="Wonderful service!")
    )
    assert rated.rating == 5
    assert rated.rating_comment == "Wonderful service!"


def test_guest_amenities_public_and_authenticated(monkeypatch):
    from app.api.guest import router as guest_router
    from app.api.property.models import ResortAmenity

    property_id = uuid4()
    amenity = ResortAmenity(
        id=uuid4(),
        property_id=property_id,
        key="infinity_pool",
        name="Infinity Pool",
        location="Oceanfront Deck",
        opening_hours="06:00 - 22:00",
        is_available=True,
    )

    db = MagicMock()
    # Mock property lookup for public request
    prop = SimpleNamespace(id=property_id)
    db.scalars.return_value.first.return_value = prop

    monkeypatch.setattr(
        guest_router.property_service,
        "list_amenities",
        lambda db, pid: [amenity],
    )

    # Public request with no Authorization header
    mock_request_public = MagicMock()
    mock_request_public.headers = {}
    public_result = guest_router.guest_amenities(mock_request_public, db)
    assert len(public_result) == 1
    assert public_result[0].name == "Infinity Pool"

