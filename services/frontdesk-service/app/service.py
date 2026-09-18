"""Bookings, check-in/out and the visit history behind Guest DNA."""
from __future__ import annotations

import secrets
import string
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from vesper_common.clients import guest as guest_client
from vesper_common.clients import property_client
from vesper_common.clock import local_today, utcnow
from vesper_common.errors import Conflict, Invalid, NotFound
from vesper_common.events import Event, bus

from .models import Booking, BookingStatus, GuestVisit, Stay, StayStatus, VisitKind

REFERENCE_ALPHABET = string.ascii_uppercase + string.digits


def _reference() -> str:
    return "VS" + "".join(secrets.choice(REFERENCE_ALPHABET) for _ in range(6))


def get_booking(db: Session, property_id: UUID, booking_id: UUID) -> Booking:
    query = select(Booking).where(Booking.id == booking_id, Booking.property_id == property_id)
    booking = db.scalars(query).first()
    if booking is None:
        raise NotFound("Booking not found")
    return booking


def list_bookings(
    db: Session,
    property_id: UUID,
    *,
    status: str | None = None,
    arriving_on: date | None = None,
    departing_on: date | None = None,
    guest_id: UUID | None = None,
) -> list[Booking]:
    query = select(Booking).where(Booking.property_id == property_id)
    if status:
        query = query.where(Booking.status == status)
    if arriving_on:
        query = query.where(Booking.check_in_date == arriving_on)
    if departing_on:
        query = query.where(Booking.check_out_date == departing_on)
    if guest_id:
        query = query.where(Booking.guest_id == guest_id)
    return list(db.scalars(query.order_by(Booking.check_in_date)))


def create_booking(db: Session, property_id: UUID, data, *, actor_id: str | None = None) -> Booking:
    if data.check_out_date <= data.check_in_date:
        raise Invalid("Check-out must be after check-in")

    nights = (data.check_out_date - data.check_in_date).days
    booking = Booking(
        property_id=property_id,
        guest_id=data.guest_id,
        room_category_id=data.room_category_id,
        reference=_reference(),
        check_in_date=data.check_in_date,
        check_out_date=data.check_out_date,
        adults=data.adults,
        children=data.children,
        rate=data.rate,
        total_amount=Decimal(data.rate) * nights,
        source=data.source,
        special_requests=data.special_requests,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    bus.publish(
        Event.BOOKING_CREATED,
        {
            "booking_id": str(booking.id),
            "reference": booking.reference,
            "guest_id": str(booking.guest_id),
            "room_category_id": str(booking.room_category_id),
            "check_in_date": booking.check_in_date.isoformat(),
            "check_out_date": booking.check_out_date.isoformat(),
            "nights": nights,
            "rate": float(booking.rate),
            "source": booking.source,
        },
        property_id=str(property_id),
        actor_id=actor_id,
    )
    return booking


def check_in(
    db: Session, property_id: UUID, booking_id: UUID, room_id: UUID, *, actor_id: str
) -> Stay:
    """Allocate a room and open a stay.

    The room must be ready and free. A double-allocated room is the one front-desk bug
    that a guest notices immediately, so both checks happen before anything is written.
    """
    booking = get_booking(db, property_id, booking_id)
    if booking.status != BookingStatus.CONFIRMED:
        raise Conflict(f"That booking is {booking.status}, not confirmed")

    occupied = db.scalars(
        select(Stay).where(
            Stay.property_id == property_id,
            Stay.room_id == room_id,
            Stay.status == StayStatus.IN_HOUSE,
        )
    ).first()
    if occupied is not None:
        raise Conflict("That room is already occupied")

    room = property_client.get(f"/rooms/{room_id}", property_id=property_id)
    if room is None:
        raise NotFound("Room not found")
    if room["status"] not in {"ready", "inspection"}:
        raise Conflict(f"Room {room['number']} is {room['status']} — it is not ready for a guest")

    stay = Stay(
        property_id=property_id,
        booking_id=booking.id,
        guest_id=booking.guest_id,
        room_id=room_id,
        room_number=room["number"],
        checked_in_at=utcnow(),
        folio_total=booking.total_amount,
    )
    booking.status = BookingStatus.CHECKED_IN
    booking.room_id = room_id
    db.add(stay)
    db.commit()
    db.refresh(stay)

    # property-service flips the room to occupied off this event.
    bus.publish(
        Event.GUEST_CHECKED_IN,
        {
            "stay_id": str(stay.id),
            "booking_id": str(booking.id),
            "guest_id": str(booking.guest_id),
            "room_id": str(room_id),
            "room_number": room["number"],
            "nights": booking.nights,
        },
        property_id=str(property_id),
        actor_id=actor_id,
    )
    return stay


def check_out(db: Session, property_id: UUID, stay_id: UUID, *, actor_id: str) -> Stay:
    stay = get_stay(db, property_id, stay_id)
    if stay.status != StayStatus.IN_HOUSE:
        raise Conflict("That stay is already closed")

    stay.status = StayStatus.CHECKED_OUT
    stay.checked_out_at = utcnow()
    stay.booking.status = BookingStatus.CHECKED_OUT

    # The stay itself is a visit — this is the row Guest DNA counts.
    record_visit(
        db,
        property_id,
        guest_id=stay.guest_id,
        kind=VisitKind.STAY,
        amount=Decimal(stay.folio_total),
        stay_id=stay.id,
        occurred_on=local_today(),
        commit=False,
    )
    db.commit()
    db.refresh(stay)

    # property-service dirties the room and rotates its QR secret off this event.
    bus.publish(
        Event.GUEST_CHECKED_OUT,
        {
            "stay_id": str(stay.id),
            "guest_id": str(stay.guest_id),
            "room_id": str(stay.room_id),
            "room_number": stay.room_number,
            "nights": stay.booking.nights,
            "folio_total": float(stay.folio_total),
        },
        property_id=str(property_id),
        actor_id=actor_id,
    )
    return stay


def get_stay(db: Session, property_id: UUID, stay_id: UUID) -> Stay:
    query = (
        select(Stay)
        .options(joinedload(Stay.booking))
        .where(Stay.id == stay_id, Stay.property_id == property_id)
    )
    stay = db.scalars(query).first()
    if stay is None:
        raise NotFound("Stay not found")
    return stay


def stay_by_room(db: Session, property_id: UUID, room_id: UUID) -> Stay | None:
    """What a QR scan resolves to. None means the room is empty."""
    query = select(Stay).where(
        Stay.property_id == property_id,
        Stay.room_id == room_id,
        Stay.status == StayStatus.IN_HOUSE,
    )
    return db.scalars(query).first()


def list_stays(db: Session, property_id: UUID, *, status: str | None = StayStatus.IN_HOUSE) -> list[Stay]:
    query = select(Stay).where(Stay.property_id == property_id)
    if status:
        query = query.where(Stay.status == status)
    return list(db.scalars(query.order_by(Stay.checked_in_at.desc())))


def record_visit(
    db: Session,
    property_id: UUID,
    *,
    guest_id: UUID,
    kind: str,
    amount: Decimal,
    stay_id: UUID | None = None,
    outlet: str | None = None,
    occurred_on: date | None = None,
    meta: dict | None = None,
    commit: bool = True,
) -> GuestVisit:
    visit = GuestVisit(
        property_id=property_id,
        guest_id=guest_id,
        stay_id=stay_id,
        kind=kind,
        occurred_on=occurred_on or local_today(),
        amount=amount,
        outlet=outlet,
        meta=meta or {},
    )
    db.add(visit)
    if commit:
        db.commit()
        db.refresh(visit)
    return visit


def guest_visits(db: Session, property_id: UUID, guest_id: UUID) -> list[GuestVisit]:
    query = (
        select(GuestVisit)
        .where(GuestVisit.property_id == property_id, GuestVisit.guest_id == guest_id)
        .order_by(GuestVisit.occurred_on.desc())
    )
    return list(db.scalars(query))


def guest_profile(db: Session, property_id: UUID, guest_id: UUID) -> dict:
    """Visit counts and spend, the numeric half of Guest DNA."""
    visits = guest_visits(db, property_id, guest_id)
    stays = [v for v in visits if v.kind == VisitKind.STAY]
    by_kind: dict[str, int] = {}
    for visit in visits:
        by_kind[visit.kind] = by_kind.get(visit.kind, 0) + 1

    total_spend = sum(Decimal(v.amount) for v in visits)
    last_visit = visits[0].occurred_on if visits else None
    return {
        "guest_id": guest_id,
        "total_visits": len(visits),
        "total_stays": len(stays),
        "visits_by_kind": by_kind,
        "total_spend": float(total_spend),
        "average_spend": float(total_spend / len(visits)) if visits else 0.0,
        "first_visit": visits[-1].occurred_on if visits else None,
        "last_visit": last_visit,
        "days_since_last_visit": (local_today() - last_visit).days if last_visit else None,
    }


def arrivals_and_departures(db: Session, property_id: UUID, day: date | None = None) -> dict:
    """The front desk's morning screen."""
    target = day or local_today()
    arriving = list_bookings(db, property_id, status=BookingStatus.CONFIRMED, arriving_on=target)
    departing = [
        s for s in list_stays(db, property_id) if s.booking.check_out_date == target
    ]
    in_house = list_stays(db, property_id)
    return {
        "date": target,
        "arrivals": arriving,
        "departures": departing,
        "in_house_count": len(in_house),
    }


def occupancy_history(db: Session, property_id: UUID, *, days: int = 180) -> list[dict]:
    """Nightly room-nights sold, the training series for the demand forecast."""
    since = local_today() - timedelta(days=days)
    rows = db.execute(
        select(
            Booking.check_in_date.label("day"),
            func.count(Booking.id).label("bookings"),
            func.avg(Booking.rate).label("average_rate"),
        )
        .where(
            Booking.property_id == property_id,
            Booking.check_in_date >= since,
            Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.NO_SHOW]),
        )
        .group_by(Booking.check_in_date)
        .order_by(Booking.check_in_date)
    ).all()
    return [
        {"date": r.day.isoformat(), "bookings": r.bookings, "average_rate": float(r.average_rate or 0)}
        for r in rows
    ]


def enrich_stay(db: Session, property_id: UUID, stay: Stay) -> dict:
    """The payload guest-service needs to open a QR session in one call."""
    guest_row = guest_client.get(f"/guests/{stay.guest_id}", property_id=property_id) or {}
    property_row = property_client.get("/property", property_id=property_id) or {}
    return {
        "id": str(stay.id),
        "property_id": str(stay.property_id),
        "status": stay.status,
        "room_id": str(stay.room_id),
        "room_number": stay.room_number,
        "guest_id": str(stay.guest_id),
        "guest_name": guest_row.get("full_name"),
        "property_name": property_row.get("name", "Vesper"),
        "checked_in_at": stay.checked_in_at.isoformat(),
    }
