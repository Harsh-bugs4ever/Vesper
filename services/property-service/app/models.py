"""The physical resort: property, departments, room categories, rooms, assets.

Every other service points at these rows by UUID. Room status lives here because the
housekeeping board, the front desk board and the guest QR all need the same answer.
"""
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from vesper_common.db import Base, TimestampMixin, uuid_pk, uuid_ref

SCHEMA = "property"


class RoomStatus(StrEnum):
    """The housekeeping loop. A check-out flips OCCUPIED → DIRTY automatically."""

    READY = "ready"
    OCCUPIED = "occupied"
    DIRTY = "dirty"
    CLEANING = "cleaning"
    INSPECTION = "inspection"
    OUT_OF_ORDER = "out_of_order"


class AssetCriticality(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Property(Base, TimestampMixin):
    __tablename__ = "properties"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    city: Mapped[str] = mapped_column(String(80), default="Mumbai", nullable=False)
    timezone: Mapped[str] = mapped_column(String(48), default="Asia/Kolkata", nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    total_rooms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    check_in_hour: Mapped[int] = mapped_column(Integer, default=14, nullable=False)
    check_out_hour: Mapped[int] = mapped_column(Integer, default=11, nullable=False)

    # System-wide switches the owner controls (Day 9): shadow mode, cold-start overrides.
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    departments: Mapped[list["Department"]] = relationship(back_populates="property")


class Department(Base, TimestampMixin):
    __tablename__ = "departments"
    __table_args__ = (UniqueConstraint("property_id", "key"), {"schema": SCHEMA})

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.properties.id"), nullable=False, index=True
    )
    key: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    # How long this department has to answer a guest request before it goes overdue.
    default_sla_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    head_user_id: Mapped[UUID | None] = uuid_ref()

    property: Mapped[Property] = relationship(back_populates="departments")


class RoomCategory(Base, TimestampMixin):
    __tablename__ = "room_categories"
    __table_args__ = (UniqueConstraint("property_id", "key"), {"schema": SCHEMA})

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.properties.id"), nullable=False, index=True
    )
    key: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    base_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    max_occupancy: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    amenities: Mapped[list[str]] = mapped_column(ARRAY(String(48)), default=list, nullable=False)

    rooms: Mapped[list["Room"]] = relationship(back_populates="category")


class Room(Base, TimestampMixin):
    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("property_id", "number"), {"schema": SCHEMA})

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.properties.id"), nullable=False, index=True
    )
    category_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.room_categories.id"), nullable=False, index=True
    )
    number: Mapped[str] = mapped_column(String(12), nullable=False)
    floor: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default=RoomStatus.READY, nullable=False, index=True)
    # Rotated on every check-out so a departed guest's QR stops working.
    qr_secret: Mapped[str] = mapped_column(String(64), nullable=False)
    status_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    category: Mapped[RoomCategory] = relationship(back_populates="rooms")


class Asset(Base, TimestampMixin):
    """Anything maintenance-service scores: chillers, lifts, pumps, kitchen equipment."""

    __tablename__ = "assets"
    __table_args__ = (UniqueConstraint("property_id", "code"), {"schema": SCHEMA})

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.properties.id"), nullable=False, index=True
    )
    department_id: Mapped[UUID | None] = uuid_ref()
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    location: Mapped[str | None] = mapped_column(String(120))
    criticality: Mapped[str] = mapped_column(String(16), default=AssetCriticality.MEDIUM, nullable=False)
    installed_on: Mapped[date | None] = mapped_column(Date)
    last_serviced_on: Mapped[date | None] = mapped_column(Date)
    service_interval_days: Mapped[int] = mapped_column(Integer, default=180, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class SensorReading(Base):
    """Raw BMS telemetry. Maintenance-service reads it; nothing else should."""

    __tablename__ = "sensor_readings"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    asset_id: Mapped[UUID] = mapped_column(ForeignKey(f"{SCHEMA}.assets.id"), nullable=False, index=True)
    metric: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    value: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    unit: Mapped[str] = mapped_column(String(16), default="", nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


class ImportJob(Base, TimestampMixin):
    """CSV import with a dry run (Day 9): validate first, commit only if asked."""

    __tablename__ = "import_jobs"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    entity: Mapped[str] = mapped_column(String(32), nullable=False)
    filename: Mapped[str] = mapped_column(String(200), nullable=False)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    total_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    accepted_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    errors: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    created_by: Mapped[UUID | None] = uuid_ref()
