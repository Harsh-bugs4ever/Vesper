"""Sentiment records, guest DNA snapshots, retention offers and the knowledge base."""
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, Float, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from vesper_common.db import Base, TimestampMixin, uuid_pk, uuid_ref

SCHEMA = "guest_intel"


class OfferStatus(StrEnum):
    SUGGESTED = "suggested"
    APPROVED = "approved"
    SENT = "sent"
    REDEEMED = "redeemed"
    EXPIRED = "expired"
    REJECTED = "rejected"


class SentimentRecord(Base, TimestampMixin):
    """One scored piece of guest feedback."""

    __tablename__ = "sentiment_records"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    guest_id: Mapped[UUID | None] = uuid_ref()
    request_id: Mapped[UUID | None] = uuid_ref()
    department_id: Mapped[UUID | None] = uuid_ref()

    comment: Mapped[str | None] = mapped_column(Text)
    rating: Mapped[int | None] = mapped_column(Float)
    # -1.0 .. +1.0
    score: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(16), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # "transformer", "lexicon" or "rating_only" — never implied, always recorded.
    method: Mapped[str] = mapped_column(String(16), default="lexicon", nullable=False)
    themes: Mapped[list[str]] = mapped_column(ARRAY(String(32)), default=list, nullable=False)
    occurred_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)


class GuestDna(Base, TimestampMixin):
    """One row per guest, rebuilt whenever their history changes."""

    __tablename__ = "guest_dna"
    __table_args__ = (UniqueConstraint("property_id", "guest_id"), {"schema": SCHEMA})

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    guest_id: Mapped[UUID] = uuid_ref(nullable=False)

    # The preference chips, each with its own confidence.
    preferences: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    favourite_items: Mapped[list[str]] = mapped_column(ARRAY(String(120)), default=list, nullable=False)
    average_sentiment: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    sentiment_label: Mapped[str] = mapped_column(String(16), default="neutral", nullable=False)
    complaint_themes: Mapped[list[str]] = mapped_column(ARRAY(String(32)), default=list, nullable=False)
    segment: Mapped[str] = mapped_column(String(16), default="new", nullable=False, index=True)
    observations: Mapped[int] = mapped_column(Float, default=0, nullable=False)

    # Retention side.
    is_at_risk: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    risk_reasons: Mapped[list[str]] = mapped_column(ARRAY(String(200)), default=list, nullable=False)
    typical_gap_days: Mapped[float | None] = mapped_column(Float)
    days_since_last_visit: Mapped[int | None] = mapped_column(Float)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class RetentionOffer(Base, TimestampMixin):
    """An offer to win a drifting guest back. Always human-approved before it is sent."""

    __tablename__ = "retention_offers"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    guest_id: Mapped[UUID] = uuid_ref(nullable=False, index=True)
    source_card_id: Mapped[UUID | None] = uuid_ref()

    offer_type: Mapped[str] = mapped_column(String(24), default="discount", nullable=False)
    discount_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    estimated_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    channel: Mapped[str] = mapped_column(String(16), default="whatsapp", nullable=False)
    rationale: Mapped[str | None] = mapped_column(Text)

    status: Mapped[str] = mapped_column(
        String(16), default=OfferStatus.SUGGESTED, nullable=False, index=True
    )
    approved_by: Mapped[UUID | None] = uuid_ref()
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_on: Mapped[date | None] = mapped_column(Date)


class KnowledgePassage(Base, TimestampMixin):
    """What the concierge is allowed to answer from. Nothing else."""

    __tablename__ = "knowledge_passages"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(48), default="general", nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ConciergeMessage(Base, TimestampMixin):
    """Transcript, for the escalation queue and for spotting what we cannot answer."""

    __tablename__ = "concierge_messages"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    stay_id: Mapped[UUID | None] = uuid_ref()
    guest_id: Mapped[UUID | None] = uuid_ref()
    asked_by_user_id: Mapped[UUID | None] = uuid_ref()

    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    model: Mapped[str | None] = mapped_column(String(64))
    outcome: Mapped[str] = mapped_column(String(20), default="answered", nullable=False, index=True)
    escalated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    escalation_reason: Mapped[str | None] = mapped_column(String(48))
    # Set when a human picks the escalation up.
    handled_by: Mapped[UUID | None] = uuid_ref()
    handled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
