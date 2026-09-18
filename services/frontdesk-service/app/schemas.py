from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .models import VisitKind


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class BookingOut(ORMModel):
    id: UUID
    reference: str
    guest_id: UUID
    room_category_id: UUID
    room_id: UUID | None = None
    check_in_date: date
    check_out_date: date
    adults: int
    children: int
    rate: Decimal
    total_amount: Decimal
    source: str
    status: str
    special_requests: str | None = None


class BookingCreate(BaseModel):
    guest_id: UUID
    room_category_id: UUID
    check_in_date: date
    check_out_date: date
    rate: Decimal = Field(gt=0)
    adults: int = Field(default=1, ge=1, le=8)
    children: int = Field(default=0, ge=0, le=8)
    source: str = "direct"
    special_requests: str | None = None


class CheckInRequest(BaseModel):
    room_id: UUID


class StayOut(ORMModel):
    id: UUID
    booking_id: UUID
    guest_id: UUID
    room_id: UUID
    room_number: str
    checked_in_at: datetime
    checked_out_at: datetime | None = None
    status: str
    folio_total: Decimal


class StayContext(BaseModel):
    """What guest-service reads when a QR is scanned."""

    id: UUID
    property_id: UUID
    status: str
    room_id: UUID
    room_number: str
    guest_id: UUID
    guest_name: str | None = None
    property_name: str
    checked_in_at: datetime


class VisitOut(ORMModel):
    id: UUID
    guest_id: UUID
    stay_id: UUID | None = None
    kind: str
    occurred_on: date
    amount: Decimal
    outlet: str | None = None
    meta: dict


class VisitCreate(BaseModel):
    guest_id: UUID
    kind: VisitKind
    amount: Decimal = Decimal("0")
    outlet: str | None = None
    occurred_on: date | None = None
    stay_id: UUID | None = None
    meta: dict = Field(default_factory=dict)


class GuestProfileOut(BaseModel):
    guest_id: UUID
    total_visits: int
    total_stays: int
    visits_by_kind: dict[str, int]
    total_spend: float
    average_spend: float
    first_visit: date | None = None
    last_visit: date | None = None
    days_since_last_visit: int | None = None


class FrontDeskDay(BaseModel):
    date: date
    arrivals: list[BookingOut]
    departures: list[StayOut]
    in_house_count: int
