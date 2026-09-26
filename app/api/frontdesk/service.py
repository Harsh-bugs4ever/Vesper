"""Bookings, check-in/out and the visit history behind Guest DNA."""
from __future__ import annotations

import secrets
import string
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from vesper_common.clients import guest as guest_client
from vesper_common.clients import property_client
from vesper_common.clock import local_today, utcnow
from vesper_common.errors import Conflict, Invalid, NotFound
from vesper_common.events import Event, bus
from app.api.property.models import Room, RoomStatus

from .models import Booking, BookingStatus, GuestVisit, Stay, StayStatus, VisitKind

REFERENCE_ALPHABET = string.ascii_uppercase + string.digits


# Six characters from a 36-letter alphabet is 2.2 billion combinations — plenty for one
# property, but "unlikely" is not "impossible", and a booking reference is unique in the
# database. Collisions are retried rather than returned to the front desk as a 500.
REFERENCE_ATTEMPTS = 5


def _reference() -> str:
    return "VS" + "".join(secrets.choice(REFERENCE_ALPHABET) for _ in range(6))


def _unique_reference(db: Session, property_id: UUID) -> str:
    for _ in range(REFERENCE_ATTEMPTS):
        candidate = _reference()
        clash = select(Booking).where(
            Booking.property_id == property_id, Booking.reference == candidate
        )
        if db.scalars(clash).first() is None:
            return candidate
    raise Conflict("Could not allocate a booking reference — please try again")


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
    from app.api.guest.models import Guest
    from app.api.property.models import RoomCategory
    guest = db.get(Guest, data.guest_id)
    category = db.get(RoomCategory, data.room_category_id)
    if guest is None or guest.property_id != property_id or category is None or category.property_id != property_id:
        raise NotFound("Guest or room category not found at this property")
    if data.check_out_date <= data.check_in_date:
        raise Invalid("Check-out must be after check-in")

    nights = (data.check_out_date - data.check_in_date).days
    booking = Booking(
        property_id=property_id,
        guest_id=data.guest_id,
        room_category_id=data.room_category_id,
        reference=_unique_reference(db, property_id),
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

    # Serialize allocation for this door. The partial unique index on active stays is
    # the final guard if another writer bypasses this service.
    room = db.scalars(select(Room).where(
        Room.id == room_id, Room.property_id == property_id,
    ).with_for_update()).first()
    if room is None:
        raise NotFound("Room not found")
    if room.category_id != booking.room_category_id:
        raise Conflict("Room is not in the booked category")
    occupied = db.scalars(
        select(Stay).where(
            Stay.property_id == property_id,
            Stay.room_id == room_id,
            Stay.status == StayStatus.IN_HOUSE,
        )
    ).first()
    if occupied is not None:
        raise Conflict("That room is already occupied")

    if room.status != RoomStatus.READY:
        raise Conflict(f"Room {room.number} is {room.status} — it is not ready for a guest")

    stay = Stay(
        property_id=property_id,
        booking_id=booking.id,
        guest_id=booking.guest_id,
        room_id=room_id,
        room_number=room.number,
        checked_in_at=utcnow(),
        folio_total=booking.total_amount,
    )
    booking.status = BookingStatus.CHECKED_IN
    booking.room_id = room_id
    db.add(stay)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise Conflict("That room or booking already has an active stay") from exc
    db.refresh(stay)

    # Readers derive occupancy from the active stay; the event informs subscribers.
    bus.publish(
        Event.GUEST_CHECKED_IN,
        {
            "stay_id": str(stay.id),
            "booking_id": str(booking.id),
            "guest_id": str(booking.guest_id),
            "room_id": str(room_id),
            "room_number": room.number,
            "nights": booking.nights,
        },
        property_id=str(property_id),
        actor_id=actor_id,
    )
    return stay


def check_out(db: Session, property_id: UUID, stay_id: UUID, *, actor_id: str) -> Stay:
    stay = db.scalars(select(Stay).where(Stay.id == stay_id,
        Stay.property_id == property_id).with_for_update()).first()
    if stay is None:
        raise NotFound("Stay not found")
    if stay.status != StayStatus.IN_HOUSE:
        raise Conflict("That stay is already closed")

    stay.status = StayStatus.CHECKED_OUT
    stay.checked_out_at = utcnow()
    stay.booking.status = BookingStatus.CHECKED_OUT
    # Room turnover and access revocation commit with the stay. A delayed event must
    # never leave a checked-out guest's QR usable or housekeeping falsely ready.
    room = db.scalars(select(Room).where(Room.id == stay.room_id,
        Room.property_id == property_id).with_for_update()).first()
    if room is None:
        raise NotFound("Room not found")
    previous_room_status = room.status
    room.status = RoomStatus.DIRTY
    room.status_changed_at = utcnow()
    room.qr_secret = secrets.token_urlsafe(24)

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

    bus.publish(
        Event.ROOM_STATUS_CHANGED,
        {"room_id": str(room.id), "room_number": room.number, "floor": room.floor,
         "from": previous_room_status, "to": RoomStatus.DIRTY.value},
        property_id=str(property_id), actor_id=actor_id,
    )
    # Room turnover was committed above; the event informs subscribers.
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
    # The booking is eager-loaded because StayOut exposes its checkout date; without this
    # a list of eighty stays would fire eighty extra queries.
    query = select(Stay).options(joinedload(Stay.booking)).where(Stay.property_id == property_id)
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
    """Room-nights occupied per night — the series the demand forecast is fitted on.

    Counting arrivals per date is the tempting shortcut and it is wrong: with an average
    stay of 2.4 nights it under-reports occupancy by roughly that factor, because a guest
    who checks in on Monday for three nights occupies a room on Tuesday and Wednesday
    too. That error flows straight into the rate card, so each booking is expanded across
    the nights it actually covers.

    The check-out date is excluded: a guest leaving on Thursday did not sleep there on
    Thursday night.
    """
    since = local_today() - timedelta(days=days)
    rows = db.execute(
        text(
            """
            SELECT night::date AS day,
                   count(*)    AS rooms_occupied,
                   avg(b.rate) AS average_rate
            FROM frontdesk.bookings b
            CROSS JOIN LATERAL generate_series(
                b.check_in_date,
                b.check_out_date - INTERVAL '1 day',
                INTERVAL '1 day'
            ) AS night
            WHERE b.property_id = :property_id
              AND b.status NOT IN ('cancelled', 'no_show')
              AND night >= :since
            GROUP BY night
            ORDER BY night
            """
        ),
        {"property_id": property_id, "since": since},
    ).all()
    return [
        {
            "date": r.day.isoformat(),
            # Kept as `bookings` for the existing contract; it is rooms occupied.
            "bookings": r.rooms_occupied,
            "rooms_occupied": r.rooms_occupied,
            "average_rate": float(r.average_rate or 0),
        }
        for r in rows
    ]


def enrich_stay(db: Session, property_id: UUID, stay: Stay) -> dict:
    """The payload guest-service needs to open a QR session in one call."""
    guest_row = guest_client.get(f"/guests/{stay.guest_id}", property_id=property_id) or {}
    property_row = property_client.get("/property", property_id=property_id)
    if property_row is None:
        raise NotFound("Property not found")
    return {
        "id": str(stay.id),
        "property_id": str(stay.property_id),
        "status": stay.status,
        "room_id": str(stay.room_id),
        "room_number": stay.room_number,
        "check_out_date": stay.check_out_date.isoformat(),
        "guest_id": str(stay.guest_id),
        "guest_name": guest_row.get("full_name"),
        "property_name": property_row["name"],
        "checked_in_at": stay.checked_in_at.isoformat(),
    }
