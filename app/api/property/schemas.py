from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .models import RoomStatus


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


class RoomOut(ORMModel):
    id: UUID
    number: str
    floor: int
    status: str
    category_id: UUID
    status_changed_at: datetime | None = None
    notes: str | None = None


class RoomDetail(RoomOut):
    category_key: str
    category_name: str


class RoomStatusUpdate(BaseModel):
    status: RoomStatus
    note: str | None = None


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
