"""Seed Food & Beverage (F&B) room-service order book, guest dining history, and kitchen metrics.

Seeds historical room-service orders, active in-house dining requests across various
statuses (raised, accepted, in_progress, delivered, overdue), guest F&B spend visits,
and ratings/feedback.

Run standalone: python scripts/seed_fnb.py
Or imported directly by scripts/seed.py
"""
from __future__ import annotations

import argparse
import random
import sys
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py-common"))

from sqlalchemy import select  # noqa: E402

from vesper_common.clock import property_tz, utcnow  # noqa: E402
from vesper_common.db import get_engine, import_all_models, session_scope  # noqa: E402

# Fixed seed for repeatable story
random.seed(20260918)

SAMPLE_NOTES = [
    "No mayo please, extra mint chutney",
    "Please send extra napkins and cutlery for two",
    "Leave order outside the room door, thank you",
    "Make it extra spicy",
    "Mild spice for children, non-dairy if possible",
    "Please deliver around 8:30 AM sharply",
    "Gluten free if possible",
    "Extra ice with beverages",
    "Please include cutlery for two",
    "Please call the room before delivery",
]

POSITIVE_RATINGS = [
    (5, "Prompt service and delicious butter chicken!"),
    (5, "Hot, fresh food delivered in under 20 minutes. Exceptional."),
    (5, "The masala chai and omelette were perfect."),
    (4, "Great meal, good portions. Will order again."),
    (4, "Food arrived warm and nicely packaged."),
    (5, "Fantastic Biryani! High quality ingredients."),
]

MIXED_RATINGS = [
    (3, "Food was good but took a bit longer than estimated."),
    (3, "Cold coffee was great, but rolls were lukewarm."),
    (2, "Order was delayed by 25 minutes. Packaging leaked slightly."),
    (1, "Items were missing from order and arrived cold."),
]


def seed_fnb_data(db, *, property_id: UUID | None = None) -> dict[str, int]:
    """Seed F&B service requests, orders, and guest spend visits."""
    import_all_models(str(REPO_ROOT / "app" / "api"))
    import vesper_models.frontdesk as fd
    import vesper_models.guest as guest
    import vesper_models.identity as ident
    import vesper_models.property as prop
    import vesper_models.staff as staff

    property_row = db.get(prop.Property, property_id) if property_id else db.scalars(select(prop.Property)).first()
    if not property_row:
        raise SystemExit("No property found. Please run main seed first: python scripts/seed.py")

    pid = property_row.id

    # Get F&B department
    fnb_dept = db.scalars(
        select(prop.Department).where(
            prop.Department.property_id == pid, prop.Department.key == "fnb"
        )
    ).first()

    if fnb_dept is None:
        raise SystemExit("F&B department missing. Please run main seed first.")
    dept_id = fnb_dept.id

    # Get F&B staff / chef user for accepted_by
    chef_user = db.scalars(
        select(ident.User).where(ident.User.property_id == pid, ident.User.email == "chef@vesper.demo")
    ).first()
    if chef_user is None:
        raise SystemExit("Demo F&B manager missing. Please run main seed first.")
    chef_id = chef_user.id

    # Get available Menu items
    menu_items = list(
        db.scalars(
            select(guest.MenuItem).where(
                guest.MenuItem.property_id == pid, guest.MenuItem.is_available.is_(True)
            )
        )
    )

    if not menu_items:
        raise SystemExit("No menu items found. Please run main seed first.")

    now = utcnow()
    today = now.astimezone(property_tz()).date()
    counts = {"fnb_orders_total": 0, "fnb_orders_active": 0,
              "fnb_tasks": 0, "fnb_historical_stays": 0, "fnb_guest_visits": 0}

    # 1. Active Stays (In-House) Orders
    in_house_stays = list(
        db.scalars(
            select(fd.Stay).where(
                fd.Stay.property_id == pid,
                fd.Stay.checked_out_at.is_(None)
            )
        )
    )

    # Define active order profiles to ensure full dashboard representation
    # (raised, accepted, in_progress, delivered, overdue)
    active_profiles = [
        # (status, mins_ago, is_overdue, note)
        ("raised", 10, False, "Extra napkins please"),
        ("raised", 5, False, "No onions on sandwich"),
        ("accepted", 18, False, "Deliver ASAP"),
        ("accepted", 25, False, "Hot masala chai"),
        ("in_progress", 28, False, "Please bring condiment tray"),
        ("in_progress", 32, False, "Call when at door"),
        ("delivered", 45, False, "Leave at door"),
        ("delivered", 75, False, "Extra ice with beverages"),
        ("delivered", 110, False, "Please ring the bell on arrival"),
        ("raised", 55, True, "Urgent breakfast order"),  # Overdue (SLA 40m, raised 55m ago)
        ("accepted", 65, True, "Cold drinks & ice"),     # Overdue
    ]

    for i, stay in enumerate(in_house_stays[:len(active_profiles)]):
        status, mins_ago, is_overdue, note = active_profiles[i]
        created_time = now - timedelta(minutes=mins_ago)
        sla = 40
        due_time = created_time + timedelta(minutes=sla)

        # Pick 1-3 menu items
        order_items = random.sample(menu_items, k=random.randint(1, min(3, len(menu_items))))
        lines = []
        total_amount = Decimal("0")

        for item in order_items:
            qty = random.randint(1, 2)
            line_total = item.price * qty
            total_amount += line_total
            lines.append({
                "menu_item_id": str(item.id),
                "name": item.name,
                "quantity": qty,
                "unit_price": float(item.price),
                "total_price": float(line_total),
            })

        accepted_at = created_time + timedelta(minutes=random.randint(2, 6)) if status in {"accepted", "in_progress", "delivered"} else None
        delivered_at = created_time + timedelta(minutes=random.randint(20, 35)) if status == "delivered" else None

        request = guest.ServiceRequest(
            id=uuid4(),
            property_id=pid,
            stay_id=stay.id,
            room_id=stay.room_id,
            room_number=stay.room_number,
            guest_id=stay.guest_id,
            department_id=dept_id,
            kind="room_service",
            status=status,
            note=note,
            items=lines,
            total_amount=total_amount,
            sla_minutes=sla,
            due_at=due_time,
            created_at=created_time,
            accepted_at=accepted_at,
            accepted_by=chef_id if accepted_at else None,
            delivered_at=delivered_at,
            overdue_notified_at=now - timedelta(minutes=10) if is_overdue else None,
        )

        if status == "delivered":
            rating_choice = random.choice(POSITIVE_RATINGS)
            request.rating = rating_choice[0]
            request.rating_comment = rating_choice[1]
            request.rated_at = delivered_at + timedelta(minutes=15)

            # Record guest visit spend for F&B
            db.add(
                fd.GuestVisit(
                    property_id=pid,
                    guest_id=stay.guest_id,
                    stay_id=stay.id,
                    kind=fd.VisitKind.ROOM_SERVICE,
                    occurred_on=today,
                    amount=total_amount,
                    outlet="In-room dining",
                    meta={"request_id": str(request.id)},
                )
            )
            counts["fnb_guest_visits"] += 1

        db.add(request)
        task_status = {
            "raised": staff.TaskStatus.OPEN,
            "accepted": staff.TaskStatus.ASSIGNED,
            "in_progress": staff.TaskStatus.IN_PROGRESS,
            "delivered": staff.TaskStatus.DONE,
        }[status]
        db.add(staff.Task(
            property_id=pid, department_id=dept_id,
            assignee_id=chef_id if accepted_at else None, room_id=stay.room_id,
            title=f"Room service order — Room {stay.room_number}",
            description=note, status=task_status, priority=staff.TaskPriority.HIGH,
            source=staff.TaskSource.GUEST_REQUEST, source_ref=request.id,
            due_at=due_time, accepted_at=accepted_at,
            completed_at=delivered_at, completed_by=chef_id if delivered_at else None,
            meta={"kind": "room_service", "items": lines},
        ))
        counts["fnb_orders_total"] += 1
        counts["fnb_orders_active"] += 1
        counts["fnb_tasks"] += 1

    # Historical orders need actual stays and rooms, not placeholder UUIDs.
    rooms_by_category: dict[UUID, list] = {}
    for room in db.scalars(select(prop.Room).where(prop.Room.property_id == pid)):
        rooms_by_category.setdefault(room.category_id, []).append(room)

    # 2. Historical Past Room-Service Orders (Past 30 days)
    past_bookings = list(
        db.scalars(
            select(fd.Booking).where(
                fd.Booking.property_id == pid,
                fd.Booking.status == fd.BookingStatus.CHECKED_OUT,
                fd.Booking.check_in_date >= today - timedelta(days=30),
                fd.Booking.check_out_date <= today,
            ).order_by(fd.Booking.check_in_date.desc()).limit(120)
        )
    )

    for booking in past_bookings:
        if random.random() > 0.4:  # 40% of past bookings had room service
            continue

        matching_rooms = rooms_by_category.get(booking.room_category_id, [])
        if not matching_rooms:
            raise RuntimeError(f"No room matches booking category {booking.room_category_id}")
        room = random.choice(matching_rooms)
        checked_in = datetime.combine(booking.check_in_date, time(14),
                                      tzinfo=property_tz()).astimezone(timezone.utc)
        checked_out = datetime.combine(booking.check_out_date, time(11),
                                       tzinfo=property_tz()).astimezone(timezone.utc)
        created_time = checked_in + timedelta(hours=random.randint(1, 4))
        historical_stay = fd.Stay(
            id=uuid4(), property_id=pid, booking_id=booking.id,
            guest_id=booking.guest_id, room_id=room.id, room_number=room.number,
            checked_in_at=checked_in, checked_out_at=checked_out,
            status=fd.StayStatus.CHECKED_OUT, folio_total=booking.total_amount,
            notes="Completed demo stay with room service",
        )
        booking.room_id = room.id
        db.add(historical_stay)
        counts["fnb_historical_stays"] += 1
        sla = 40
        due_time = created_time + timedelta(minutes=sla)

        status = "cancelled" if random.random() < 0.08 else "delivered"

        # Pick 1-4 menu items
        order_items = random.sample(menu_items, k=random.randint(1, min(4, len(menu_items))))
        lines = []
        total_amount = Decimal("0")

        for item in order_items:
            qty = random.randint(1, 3)
            line_total = item.price * qty
            total_amount += line_total
            lines.append({
                "menu_item_id": str(item.id),
                "name": item.name,
                "quantity": qty,
                "unit_price": float(item.price),
                "total_price": float(line_total),
            })

        delivered_at = created_time + timedelta(minutes=random.randint(18, 38)) if status == "delivered" else None

        request = guest.ServiceRequest(
            id=uuid4(),
            property_id=pid,
            stay_id=historical_stay.id,
            room_id=room.id,
            room_number=room.number,
            guest_id=booking.guest_id,
            department_id=dept_id,
            kind="room_service",
            status=status,
            note=random.choice(SAMPLE_NOTES),
            items=lines,
            total_amount=total_amount,
            sla_minutes=sla,
            due_at=due_time,
            created_at=created_time,
            accepted_at=created_time + timedelta(minutes=3) if status == "delivered" else None,
            accepted_by=chef_id if status == "delivered" else None,
            delivered_at=delivered_at,
        )

        if status == "delivered":
            if random.random() < 0.6:  # 60% left rating
                rating_tuple = random.choice(POSITIVE_RATINGS if random.random() > 0.15 else MIXED_RATINGS)
                request.rating = rating_tuple[0]
                request.rating_comment = rating_tuple[1]
                request.rated_at = delivered_at + timedelta(minutes=random.randint(10, 120))

            db.add(
                fd.GuestVisit(
                    property_id=pid,
                    guest_id=booking.guest_id,
                    stay_id=historical_stay.id,
                    kind=fd.VisitKind.ROOM_SERVICE,
                    occurred_on=booking.check_in_date,
                    amount=total_amount,
                    outlet="In-room dining",
                    meta={"request_id": str(request.id)},
                )
            )
            counts["fnb_guest_visits"] += 1

        db.add(request)
        counts["fnb_orders_total"] += 1

    db.commit()
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed Food & Beverage (F&B) order book and spend history")
    args = parser.parse_args()

    engine = get_engine()
    import_all_models(str(REPO_ROOT / "app" / "api"))

    db = session_scope()
    try:
        counts = seed_fnb_data(db)
    finally:
        db.close()

    print("\nFood & Beverage seed complete:")
    for label, count in counts.items():
        print(f"  {label:<22} {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
