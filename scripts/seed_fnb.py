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
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

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
    "",
    "",
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


def seed_fnb_data(db) -> dict[str, int]:
    """Seed F&B service requests, orders, and guest spend visits."""
    import_all_models(str(REPO_ROOT / "app" / "api"))
    import vesper_models.frontdesk as fd
    import vesper_models.guest as guest
    import vesper_models.identity as ident
    import vesper_models.property as prop

    property_row = db.scalars(select(prop.Property)).first()
    if not property_row:
        raise SystemExit("No property found. Please run main seed first: python scripts/seed.py")

    pid = property_row.id

    # Get F&B department
    fnb_dept = db.scalars(
        select(prop.Department).where(
            prop.Department.property_id == pid, prop.Department.key == "fnb"
        )
    ).first()

    dept_id = fnb_dept.id if fnb_dept else None

    # Get F&B staff / chef user for accepted_by
    chef_user = db.scalars(
        select(ident.User).where(ident.User.property_id == pid, ident.User.email == "chef@vesper.demo")
    ).first()
    chef_id = chef_user.id if chef_user else None

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
    counts = {"fnb_orders_total": 0, "fnb_orders_active": 0, "fnb_guest_visits": 0}

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
        ("delivered", 110, False, ""),
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
                    kind=fd.VisitKind.ROOM_SERVICE,
                    occurred_on=today,
                    amount=total_amount,
                )
            )
            counts["fnb_guest_visits"] += 1

        db.add(request)
        counts["fnb_orders_total"] += 1
        counts["fnb_orders_active"] += 1

    # 2. Historical Past Room-Service Orders (Past 30 days)
    # Query past checked-out bookings / visits
    past_bookings = list(
        db.scalars(
            select(fd.Booking).where(
                fd.Booking.property_id == pid,
                fd.Booking.status == fd.BookingStatus.CHECKED_OUT,
            ).limit(120)
        )
    )

    for booking in past_bookings:
        if random.random() > 0.4:  # 40% of past bookings had room service
            continue

        days_back = (today - booking.check_in_date).days
        if days_back <= 0:
            days_back = random.randint(1, 30)

        created_time = now - timedelta(days=days_back, hours=random.randint(7, 22))
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
            property_id=pid,
            stay_id=uuid4(),  # Historical reference
            room_id=booking.room_category_id,
            room_number=f"Room-{random.randint(201, 1230)}",
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
                    kind=fd.VisitKind.ROOM_SERVICE,
                    occurred_on=booking.check_in_date,
                    amount=total_amount,
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
