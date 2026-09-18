"""Asset health snapshots and work orders.

The asset itself lives in property-service; what we keep here is our opinion of it —
the latest risk score, the anomalies behind it, and the work that came out of it.
"""
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Date, DateTime, Float, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from vesper_common.db import Base, TimestampMixin, uuid_pk, uuid_ref

SCHEMA = "maintenance"


class WorkOrderStatus(StrEnum):
    OPEN = "open"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class WorkOrderKind(StrEnum):
    PREVENTIVE = "preventive"
    CORRECTIVE = "corrective"
    INSPECTION = "inspection"


class AssetHealth(Base, TimestampMixin):
    """One row per asset, overwritten each time the engine runs."""

    __tablename__ = "asset_health"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    asset_id: Mapped[UUID] = uuid_ref(nullable=False, index=True)

    risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # The weighted reasons behind the score, shown on the risk gauge.
    drivers: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    # "isolation_forest", "robust_z" or "insufficient_data" — never implied, always said.
    method: Mapped[str] = mapped_column(String(32), default="robust_z", nullable=False)
    anomaly_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    trend_per_day: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    readings_considered: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Markers the sensor trend chart draws.
    anomalies: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    assessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class WorkOrder(Base, TimestampMixin):
    __tablename__ = "work_orders"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    asset_id: Mapped[UUID] = uuid_ref(nullable=False, index=True)
    department_id: Mapped[UUID | None] = uuid_ref()
    # The card that authorised this, when it came from the action queue.
    source_card_id: Mapped[UUID | None] = uuid_ref()
    # The task on somebody's phone, when staff-service made one.
    task_id: Mapped[UUID | None] = uuid_ref()

    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(16), default=WorkOrderKind.PREVENTIVE, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), default=WorkOrderStatus.OPEN, nullable=False, index=True
    )
    priority: Mapped[str] = mapped_column(String(12), default="normal", nullable=False)

    scheduled_for: Mapped[date | None] = mapped_column(Date, index=True)
    # Why that date was chosen — "quietest night at 41% occupancy".
    scheduling_rationale: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    estimated_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    actual_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    notes: Mapped[str | None] = mapped_column(Text)
