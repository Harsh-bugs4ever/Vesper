from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm
from vesper_common.security import Principal, current_user, requires, requires_gm

from . import service
from .schemas import (
    BookingCreate,
    BookingOut,
    CheckInRequest,
    FrontDeskDay,
    GuestProfileOut,
    StayContext,
    StayOut,
    VisitCreate,
    VisitOut,
)

def _front_office(principal: Principal = Depends(current_user), db: Session = Depends(get_session)) -> None:
    principal.require_department_key(db, "front_office")


bookings_router = APIRouter(prefix="/bookings", tags=["bookings"], dependencies=[Depends(_front_office)])
stays_router = APIRouter(prefix="/stays", tags=["stays"], dependencies=[Depends(_front_office)])
visits_router = APIRouter(prefix="/visits", tags=["visits"], dependencies=[Depends(_front_office)])


@bookings_router.get("", response_model=list[BookingOut])
def list_bookings(
    status_filter: str | None = Query(default=None, alias="status"),
    arriving_on: date | None = None,
    departing_on: date | None = None,
    guest_id: UUID | None = None,
    principal: Principal = Depends(requires(Perm.BOOKINGS_READ)),
    db: Session = Depends(get_session),
) -> list[BookingOut]:
    rows = service.list_bookings(
        db,
        UUID(principal.property_id),
        status=status_filter,
        arriving_on=arriving_on,
        departing_on=departing_on,
        guest_id=guest_id,
    )
    return [BookingOut.model_validate(r) for r in rows]


@bookings_router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    body: BookingCreate,
    principal: Principal = Depends(requires(Perm.BOOKINGS_WRITE)),
    db: Session = Depends(get_session),
) -> BookingOut:
    booking = service.create_booking(db, UUID(principal.property_id), body, actor_id=principal.id)
    return BookingOut.model_validate(booking)


@bookings_router.get("/today", response_model=FrontDeskDay)
def today(
    day: date | None = None,
    principal: Principal = Depends(requires(Perm.BOOKINGS_READ)),
    db: Session = Depends(get_session),
) -> FrontDeskDay:
    """Arrivals, departures and the in-house count — the front desk's morning screen."""
    data = service.arrivals_and_departures(db, UUID(principal.property_id), day)
    return FrontDeskDay(
        date=data["date"],
        arrivals=[BookingOut.model_validate(b) for b in data["arrivals"]],
        departures=[StayOut.model_validate(s) for s in data["departures"]],
        in_house=[StayOut.model_validate(s) for s in data["in_house"]],
        in_house_count=data["in_house_count"],
    )


@bookings_router.get("/occupancy-history", response_model=list[dict])
def occupancy_history(
    days: int = Query(default=180, ge=7, le=730),
    principal: Principal = Depends(requires_gm(Perm.FORECAST_READ)),
    db: Session = Depends(get_session),
) -> list[dict]:
    """The nightly series revenue-service trains its demand model on."""
    return service.occupancy_history(db, UUID(principal.property_id), days=days)


@bookings_router.get("/{booking_id}", response_model=BookingOut)
def get_booking(
    booking_id: UUID,
    principal: Principal = Depends(requires(Perm.BOOKINGS_READ)),
    db: Session = Depends(get_session),
) -> BookingOut:
    return BookingOut.model_validate(
        service.get_booking(db, UUID(principal.property_id), booking_id)
    )


@bookings_router.post("/{booking_id}/check-in", response_model=StayOut)
def check_in(
    booking_id: UUID,
    body: CheckInRequest,
    principal: Principal = Depends(requires(Perm.BOOKINGS_WRITE)),
    db: Session = Depends(get_session),
) -> StayOut:
    stay = service.check_in(
        db, UUID(principal.property_id), booking_id, body.room_id, actor_id=principal.id
    )
    return StayOut.model_validate(stay)


@stays_router.get("", response_model=list[StayOut])
def list_stays(
    status_filter: str | None = Query(default="in_house", alias="status"),
    principal: Principal = Depends(requires(Perm.BOOKINGS_READ)),
    db: Session = Depends(get_session),
) -> list[StayOut]:
    rows = service.list_stays(db, UUID(principal.property_id), status=status_filter)
    return [StayOut.model_validate(r) for r in rows]


@stays_router.get("/by-room", response_model=StayContext | None)
def stay_by_room(
    room_id: UUID,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> StayContext | None:
    """Resolve a scanned room to its open stay. Null means nobody is checked in."""
    property_id = UUID(principal.property_id)
    stay = service.stay_by_room(db, property_id, room_id)
    if stay is None:
        return None
    return StayContext(**service.enrich_stay(db, property_id, stay))


@stays_router.get("/{stay_id}", response_model=StayContext)
def get_stay(
    stay_id: UUID,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> StayContext:
    """Re-checked by guest-service on every guest write, so it stays cheap."""
    property_id = UUID(principal.property_id)
    stay = service.get_stay(db, property_id, stay_id)
    return StayContext(**service.enrich_stay(db, property_id, stay))


@stays_router.post("/{stay_id}/check-out", response_model=StayOut)
def check_out(
    stay_id: UUID,
    principal: Principal = Depends(requires(Perm.BOOKINGS_WRITE)),
    db: Session = Depends(get_session),
) -> StayOut:
    stay = service.check_out(db, UUID(principal.property_id), stay_id, actor_id=principal.id)
    return StayOut.model_validate(stay)


@visits_router.post("", response_model=VisitOut, status_code=status.HTTP_201_CREATED)
def record_visit(
    body: VisitCreate,
    principal: Principal = Depends(requires(Perm.BOOKINGS_WRITE)),
    db: Session = Depends(get_session),
) -> VisitOut:
    """A spa booking or a restaurant cover — a visit without a room night."""
    visit = service.record_visit(
        db,
        UUID(principal.property_id),
        guest_id=body.guest_id,
        kind=body.kind.value,
        amount=body.amount,
        stay_id=body.stay_id,
        outlet=body.outlet,
        occurred_on=body.occurred_on,
        meta=body.meta,
    )
    return VisitOut.model_validate(visit)


@visits_router.get("/{guest_id}", response_model=list[VisitOut])
def guest_visits(
    guest_id: UUID,
    principal: Principal = Depends(requires(Perm.GUESTS_READ)),
    db: Session = Depends(get_session),
) -> list[VisitOut]:
    rows = service.guest_visits(db, UUID(principal.property_id), guest_id)
    return [VisitOut.model_validate(r) for r in rows]


@visits_router.get("/{guest_id}/profile", response_model=GuestProfileOut)
def guest_profile(
    guest_id: UUID,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> GuestProfileOut:
    """Visit counts and spend. guest-intel joins this with sentiment to build Guest DNA."""
    return GuestProfileOut(**service.guest_profile(db, UUID(principal.property_id), guest_id))
