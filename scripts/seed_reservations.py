"""Add demo reservations to one existing property without resetting its data.

Examples:
  python scripts/seed_reservations.py --list-properties
  python scripts/seed_reservations.py --property-id UUID --count 48
  python scripts/seed_reservations.py --property-id UUID --count 48 --apply

The default is a read-only preview. An applied run creates confirmed bookings and
clearly fictional guests, but never assigns rooms or opens stays. Repeating the same
property/start-date run skips its existing reservation references.
"""
from __future__ import annotations

import argparse
import random
import sys
from collections import Counter
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py-common"))

from sqlalchemy import func, select  # noqa: E402

from vesper_common.clock import utcnow  # noqa: E402
from vesper_common.db import import_all_models, session_scope  # noqa: E402


def _models():
    import_all_models(str(REPO_ROOT / "app" / "api"))
    import vesper_models.frontdesk as frontdesk
    import vesper_models.guest as guest
    import vesper_models.property as property_models
    return frontdesk, guest, property_models


def _reference(start: date, index: int) -> str:
    return f"RS{start:%y%m%d}{index:05d}"


def seed_reservations(db, *, property_id: UUID, count: int, start: date,
                      days: int, apply: bool) -> dict[str, int | str]:
    frontdesk, guest, property_models = _models()
    resort = db.get(property_models.Property, property_id)
    if resort is None:
        raise ValueError("Property not found")
    today = utcnow().astimezone(ZoneInfo(resort.timezone)).date()
    if start < today:
        raise ValueError("Start date must be today or later")
    if not 1 <= count <= 5000 or not 1 <= days <= 365:
        raise ValueError("Count must be 1–5000 and days must be 1–365")

    categories = list(db.scalars(select(property_models.RoomCategory).where(
        property_models.RoomCategory.property_id == property_id,
    ).order_by(property_models.RoomCategory.key)))
    room_counts = dict(db.execute(select(
        property_models.Room.category_id, func.count(property_models.Room.id),
    ).where(
        property_models.Room.property_id == property_id,
        property_models.Room.status != property_models.RoomStatus.OUT_OF_ORDER,
    ).group_by(property_models.Room.category_id)).all())
    categories = [category for category in categories
                  if room_counts.get(category.id, 0) > 0 and category.max_occupancy > 0]
    if not categories:
        raise ValueError("Property has no bookable room categories")

    last_checkout = start + timedelta(days=days + 4)
    reservations = list(db.scalars(select(frontdesk.Booking).where(
        frontdesk.Booking.property_id == property_id,
        frontdesk.Booking.check_in_date < last_checkout,
        frontdesk.Booking.check_out_date > start,
        frontdesk.Booking.status.notin_([
            frontdesk.BookingStatus.CANCELLED, frontdesk.BookingStatus.NO_SHOW,
        ]),
    )))
    occupied_nights: Counter[tuple[UUID, date]] = Counter()
    for booking in reservations:
        night = max(booking.check_in_date, start)
        while night < min(booking.check_out_date, last_checkout):
            occupied_nights[booking.room_category_id, night] += 1
            night += timedelta(days=1)

    prefix = _reference(start, 0)[:-5]
    existing = {booking.reference: booking for booking in db.scalars(
        select(frontdesk.Booking).where(
            frontdesk.Booking.property_id == property_id,
            frontdesk.Booking.reference.like(f"{prefix}%"),
        )
    )}
    rng = random.Random(f"{property_id}:{start.isoformat()}")
    new_rows: list[tuple[str, date, date, object]] = []
    skipped = 0
    no_capacity = 0
    for index in range(1, count + 1):
        reference = _reference(start, index)
        if reference in existing:
            if existing[reference].source != "demo_reservation_seed":
                raise ValueError(f"Reference {reference} already belongs to another booking")
            skipped += 1
            continue
        nights = rng.choice((1, 2, 2, 3, 4))
        allocated = None
        for offset in range(days):
            arrival = start + timedelta(days=(index - 1 + offset) % days)
            departure = arrival + timedelta(days=nights)
            choices = [category for category in categories if all(
                occupied_nights[category.id, arrival + timedelta(days=night)]
                < room_counts[category.id] for night in range(nights)
            )]
            if choices:
                allocated = (arrival, departure, rng.choice(choices))
                break
        if allocated is None:
            no_capacity += 1
            continue
        arrival, departure, category = allocated
        for night in range(nights):
            occupied_nights[category.id, arrival + timedelta(days=night)] += 1
        new_rows.append((reference, arrival, departure, category))

    if apply and no_capacity:
        raise ValueError(f"Only {len(new_rows)} of {count - skipped} new reservations fit; widen --days or reduce --count")

    if apply:
        for reference, arrival, departure, category in new_rows:
            guest_id = uuid4()
            db.add(guest.Guest(
                id=guest_id, property_id=property_id,
                full_name=f"Demo Reservation {reference[-5:]}",
                email=f"reservation-{property_id.hex[:8]}-{reference.lower()}@example.invalid",
            ))
            rate = Decimal(category.base_rate)
            db.add(frontdesk.Booking(
                property_id=property_id, guest_id=guest_id,
                room_category_id=category.id, reference=reference,
                check_in_date=arrival, check_out_date=departure,
                adults=min(2, category.max_occupancy), children=0,
                rate=rate, total_amount=rate * (departure - arrival).days,
                source="demo_reservation_seed",
                status=frontdesk.BookingStatus.CONFIRMED,
            ))
        db.commit()

    return {
        "property_id": str(property_id), "start_date": start.isoformat(),
        "requested": count, "created" if apply else "would_create": len(new_rows),
        "already_seeded": skipped, "no_capacity": no_capacity,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Preview or seed confirmed demo reservations")
    parser.add_argument("--list-properties", action="store_true", help="List property IDs for --property-id")
    parser.add_argument("--property-id", type=UUID, help="Exact property to seed")
    parser.add_argument("--count", type=int, default=48, help="Reservations to plan (default: 48)")
    parser.add_argument("--start-date", type=date.fromisoformat, help="First arrival date (YYYY-MM-DD; default: tomorrow)")
    parser.add_argument("--days", type=int, default=30, help="Arrival window in days (default: 30)")
    parser.add_argument("--apply", action="store_true", help="Write the previewed reservations")
    args = parser.parse_args()
    _, _, property_models = _models()
    with session_scope() as db:
        if args.list_properties:
            for property_id, name, city in db.execute(select(
                property_models.Property.id, property_models.Property.name,
                property_models.Property.city,
            ).order_by(property_models.Property.name, property_models.Property.id)):
                print(f"{property_id}  {name}  ({city})")
            return 0
        if args.property_id is None:
            parser.error("--property-id is required unless --list-properties is used")
        resort = db.get(property_models.Property, args.property_id)
        if resort is None:
            parser.error("Property not found")
        today = utcnow().astimezone(ZoneInfo(resort.timezone)).date()
        start = args.start_date or today + timedelta(days=1)
        try:
            result = seed_reservations(db, property_id=args.property_id,
                                       count=args.count, start=start,
                                       days=args.days, apply=args.apply)
        except ValueError as exc:
            parser.error(str(exc))
    print("Reservation seed applied:" if args.apply else "Reservation seed preview (no writes):")
    for key, value in result.items():
        print(f"  {key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
