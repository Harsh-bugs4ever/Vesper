"""Action cards, the audit log and the feedback loop.

The action card is the spine of Vesper: an engine recommends, a human decides, the system
executes, and the outcome is scored back against the engine that suggested it.
"""
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from vesper_common.db import Base, TimestampMixin, uuid_pk, uuid_ref

SCHEMA = "action"


class CardKind(StrEnum):
    """One kind per executor. Adding a kind means adding an executor and its undo."""

    RATE_CHANGE = "rate_change"
    PURCHASE = "purchase"
    WORK_ORDER = "work_order"
    ROSTER_CHANGE = "roster_change"
    RETENTION_OFFER = "retention_offer"
    STAFFING_GAP = "staffing_gap"


class CardStatus(StrEnum):
    PENDING = "pending"
    CLAIMED = "claimed"
    APPROVED = "approved"
    EXECUTED = "executed"
    UNDONE = "undone"
    SNOOZED = "snoozed"
    DISMISSED = "dismissed"
    EXPIRED = "expired"


class Urgency(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DismissReason(StrEnum):
    """Dismissals are training data, not deletions — the reason is the whole point."""

    NOT_ACCURATE = "not_accurate"
    ALREADY_HANDLED = "already_handled"
    NOT_WORTH_IT = "not_worth_it"
    BAD_TIMING = "bad_timing"
    OTHER = "other"


class ActionCard(Base, TimestampMixin):
    __tablename__ = "action_cards"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    engine: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(16), default=CardStatus.PENDING, nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(180), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    # Why the engine believes this, in plain words. Rendered as the card's driver list —
    # a manager approves a reason, not a number.
    drivers: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    impact_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    urgency: Mapped[str] = mapped_column(String(12), default=Urgency.MEDIUM, nullable=False)
    # confidence x impact x urgency, recomputed whenever any of them changes.
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False, index=True)

    department_id: Mapped[UUID | None] = uuid_ref()
    # The permission a user needs to approve this specific card.
    required_permission: Mapped[str] = mapped_column(String(64), nullable=False)

    # What the executor will do, and what it must put back on undo.
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    undo_payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    # What the manager changed before approving, if anything.
    adjustments: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # Claim lock: two managers must not act on the same card at once.
    claimed_by: Mapped[UUID | None] = uuid_ref()
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    decided_by: Mapped[UUID | None] = uuid_ref()
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Undo stays open for this long after execution; the UI counts it down.
    undo_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    undone_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    snoozed_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    dismiss_reason: Mapped[str | None] = mapped_column(String(24))
    dismiss_note: Mapped[str | None] = mapped_column(Text)
    # A rate card for next Saturday is worthless on Sunday.
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    # True when executed while shadow mode was on: logged, scored, never applied.
    was_shadow: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Set by whichever engine raised it, so a re-run updates instead of duplicating.
    dedupe_key: Mapped[str | None] = mapped_column(String(160), index=True)

    outcome: Mapped["CardOutcome | None"] = relationship(back_populates="card", uselist=False)


class CardOutcome(Base, TimestampMixin):
    """Scored days later: was the engine right?

    This is what makes the confidence numbers on the next card mean something.
    """

    __tablename__ = "card_outcomes"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    card_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.action_cards.id"), nullable=False, unique=True
    )
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    engine: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    predicted_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    actual_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    # |actual - predicted| / max(|predicted|, 1), clamped into 0..1 as accuracy.
    accuracy: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    was_helpful: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    card: Mapped[ActionCard] = relationship(back_populates="outcome")


class AuditEntry(Base, TimestampMixin):
    """Every decision, by whom, with what before and after. Append-only."""

    __tablename__ = "audit_entries"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    actor_id: Mapped[UUID | None] = uuid_ref()
    actor_role: Mapped[str | None] = mapped_column(String(32))
    action: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    entity_id: Mapped[UUID | None] = uuid_ref()
    before: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    after: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)


class EngineStat(Base, TimestampMixin):
    """Rolling accuracy per engine — the learning page and the cold-start banner."""

    __tablename__ = "engine_stats"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    engine: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    cards_raised: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cards_approved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cards_dismissed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cards_undone: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    outcomes_scored: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    mean_accuracy: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # Multiplies every new card's confidence. Earned, not configured.
    confidence_multiplier: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
