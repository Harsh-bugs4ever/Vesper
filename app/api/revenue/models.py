"""Forecasts, per-date rates and the competitor set.

Rates are stored one row per category per date. The prototype kept a single "current
rate" per category, which is why a rate change silently repriced every future date and
undo could not put things back — this shape is the fix.
"""
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Date, DateTime, Float, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from vesper_common.db import Base, TimestampMixin, uuid_pk, uuid_ref

SCHEMA = "revenue"


class RateSource(StrEnum):
    BASE = "base"
    MANUAL = "manual"
    ACTION_CARD = "action_card"
    REVERT = "revert"


class DailyRate(Base, TimestampMixin):
    """One category, one date, one price. The unit a rate card operates on."""

    __tablename__ = "daily_rates"
    __table_args__ = (
        UniqueConstraint("property_id", "room_category_id", "stay_date"),
        {"schema": SCHEMA},
    )

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    room_category_id: Mapped[UUID] = uuid_ref(nullable=False)
    stay_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    source: Mapped[str] = mapped_column(String(16), default=RateSource.BASE, nullable=False)
    # The card that set this, so the audit trail runs both ways.
    source_card_id: Mapped[UUID | None] = uuid_ref()
    changed_by: Mapped[UUID | None] = uuid_ref()


class RateHistory(Base, TimestampMixin):
    """Append-only price ledger. Undo reads from here, never from a guess."""

    __tablename__ = "rate_history"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    room_category_id: Mapped[UUID] = uuid_ref(nullable=False)
    stay_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    previous_rate: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    new_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    source_card_id: Mapped[UUID | None] = uuid_ref()
    changed_by: Mapped[UUID | None] = uuid_ref()


class DemandForecast(Base, TimestampMixin):
    """One night's predicted occupancy, with the band around it.

    The band is the honest part: a point estimate of 82% invites a decision the data
    cannot support when the interval runs from 68% to 94%.
    """

    __tablename__ = "demand_forecasts"
    __table_args__ = (UniqueConstraint("property_id", "stay_date"), {"schema": SCHEMA})

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    stay_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    predicted_occupancy: Mapped[float] = mapped_column(Float, nullable=False)
    lower_bound: Mapped[float] = mapped_column(Float, nullable=False)
    upper_bound: Mapped[float] = mapped_column(Float, nullable=False)
    predicted_adr: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    # Which model produced this, so the UI never implies more rigour than was used.
    model_name: Mapped[str] = mapped_column(String(32), default="baseline", nullable=False)
    features: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Competitor(Base, TimestampMixin):
    """The comp set. Demo data — real rate-shopping is on the backlog."""

    __tablename__ = "competitors"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    distance_km: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    star_rating: Mapped[int] = mapped_column(Integer, default=5, nullable=False)


class CompetitorRate(Base, TimestampMixin):
    __tablename__ = "competitor_rates"
    __table_args__ = (UniqueConstraint("competitor_id", "stay_date"), {"schema": SCHEMA})

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    competitor_id: Mapped[UUID] = uuid_ref(nullable=False)
    stay_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
