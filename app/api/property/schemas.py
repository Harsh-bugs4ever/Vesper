from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .models import HousekeepingStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PropertyOut(ORMModel):
    id: UUID
    name: str
    address: str | None = None
    city: str
    timezone: str
    currency: str
    total_rooms: int
    check_in_hour: int
    check_out_hour: int
    settings: dict


class PropertySummary(ORMModel):
    """Enough to name a property in a picker, and nothing more.

    The switcher in the admin header used to hold a hardcoded list. It reads this
    instead, so a property that is renamed or onboarded shows up without a deploy.
    Deliberately smaller than PropertyOut: listing every property's settings to
    populate a dropdown hands out more than the dropdown needs.
    """

    id: UUID
    name: str
    address: str | None = None
    city: str


class PropertyUpdate(BaseModel):
    name: str | None = None
    address: str | None = Field(default=None, max_length=240)
    city: str | None = Field(default=None, max_length=80)
    check_in_hour: int | None = Field(default=None, ge=0, le=23)
    check_out_hour: int | None = Field(default=None, ge=0, le=23)
    settings: dict | None = None


class DepartmentOut(ORMModel):
    id: UUID
    key: str
    name: str
    default_sla_minutes: int
    head_user_id: UUID | None = None


class RoomCategoryOut(ORMModel):
    id: UUID
    key: str
    name: str
    base_rate: Decimal
    max_occupancy: int
    amenities: list[str]
    images: list["RoomImageOut"] = Field(default_factory=list)


class RoomOut(ORMModel):
    id: UUID
    number: str
    floor: int
    status: str
    housekeeping_status: str
    occupied: bool
    category_id: UUID
    status_changed_at: datetime | None = None
    notes: str | None = None
    images: list["RoomImageOut"] = Field(default_factory=list)


class RoomDetail(RoomOut):
    category_key: str
    category_name: str


class RoomStatusUpdate(BaseModel):
    status: HousekeepingStatus
    note: str | None = None


class RoomImageOut(ORMModel):
    id: UUID
    url: str
    alt_text: str
    position: int
    is_primary: bool


class RoomImageUpdate(BaseModel):
    alt_text: str = Field(min_length=1, max_length=240)
    position: int = Field(ge=0)
    is_primary: bool = False


class AmenityWrite(BaseModel):
    key: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9_-]+$")
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    location: str | None = Field(default=None, max_length=160)
    opening_hours: str | None = Field(default=None, max_length=240)
    is_available: bool = True
    closure_reason: str | None = Field(default=None, max_length=240)
    closed_until: datetime | None = None


class AmenityOut(AmenityWrite, ORMModel):
    id: UUID
    available_now: bool


class GuestRoomOut(BaseModel):
    id: UUID
    number: str
    floor: int
    category_name: str
    category_amenities: list[str]
    images: list[RoomImageOut]


class PublicCategoryOut(BaseModel):
    key: str
    name: str
    amenities: list[str]
    images: list[RoomImageOut]


class PublicPropertyOut(BaseModel):
    id: UUID
    name: str
    address: str | None
    city: str
    categories: list[PublicCategoryOut]
    amenities: list[AmenityOut]


class RoomBoardFloor(BaseModel):
    """One row of the housekeeping board — the staff app groups by floor."""

    floor: int
    rooms: list[RoomDetail]


class RoomBoardOut(BaseModel):
    counts: dict[str, int]
    floors: list[RoomBoardFloor]


class AssetOut(ORMModel):
    id: UUID
    code: str
    name: str
    asset_type: str
    location: str | None = None
    criticality: str
    installed_on: date | None = None
    last_serviced_on: date | None = None
    service_interval_days: int
    is_active: bool


class AssetCreate(BaseModel):
    code: str
    name: str
    asset_type: str
    location: str | None = None
    criticality: str = "medium"
    department_id: UUID | None = None
    installed_on: date | None = None
    service_interval_days: int = 180


class AssetServiced(BaseModel):
    serviced_on: date


class SensorReadingIn(BaseModel):
    asset_id: UUID
    metric: str
    value: float
    unit: str = ""
    recorded_at: datetime | None = None


class SensorReadingOut(ORMModel):
    id: UUID
    asset_id: UUID
    metric: str
    value: float
    unit: str
    recorded_at: datetime


class ImportError_(BaseModel):
    row: int
    field: str | None = None
    message: str


class ImportResult(BaseModel):
    id: UUID | None = None
    entity: str
    dry_run: bool
    total_rows: int
    accepted_rows: int
    errors: list[ImportError_]


class ShadowModeUpdate(BaseModel):
    enabled: bool
