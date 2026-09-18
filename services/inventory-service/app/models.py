"""Stock items, movements and purchase orders.

Quantity is never edited directly — every change is a StockMovement, and the item's
on-hand figure is the running total. That is what makes "why is there no bread?" a
question with an answer.
"""
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from vesper_common.db import Base, TimestampMixin, uuid_pk, uuid_ref

SCHEMA = "inventory"


class StockCategory(StrEnum):
    FOOD = "food"
    BEVERAGE = "beverage"
    LINEN = "linen"
    TOILETRIES = "toiletries"
    BEDS = "beds"
    SPARE_PARTS = "spare_parts"
    CLEANING = "cleaning"


class MovementReason(StrEnum):
    PURCHASE = "purchase"
    CONSUMPTION = "consumption"
    WASTAGE = "wastage"
    EXPIRY = "expiry"
    CORRECTION = "correction"
    TRANSFER = "transfer"


class PurchaseStatus(StrEnum):
    SUGGESTED = "suggested"
    APPROVED = "approved"
    ORDERED = "ordered"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class StockItem(Base, TimestampMixin):
    __tablename__ = "stock_items"
    __table_args__ = (UniqueConstraint("property_id", "sku"), {"schema": SCHEMA})

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    department_id: Mapped[UUID | None] = uuid_ref()
    sku: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    unit: Mapped[str] = mapped_column(String(16), default="unit", nullable=False)

    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    # Cross this and a purchase suggestion is raised.
    minimum_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    reorder_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)

    expires_on: Mapped[date | None] = mapped_column(Date, index=True)
    supplier: Mapped[str | None] = mapped_column(String(120))
    lead_time_days: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Set when a suggestion is raised so we don't queue the same card every minute.
    low_flagged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    movements: Mapped[list["StockMovement"]] = relationship(back_populates="item")

    @property
    def is_low(self) -> bool:
        return self.quantity <= self.minimum_quantity

    @property
    def days_to_expiry(self) -> int | None:
        if self.expires_on is None:
            return None
        from vesper_common.clock import local_today

        return (self.expires_on - local_today()).days


class StockMovement(Base, TimestampMixin):
    """The ledger. Positive is in, negative is out."""

    __tablename__ = "stock_movements"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    item_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.stock_items.id"), nullable=False, index=True
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    reason: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(Text)
    actor_id: Mapped[UUID | None] = uuid_ref()
    # The request or purchase order that caused this, for the audit trail.
    source_ref: Mapped[UUID | None] = uuid_ref()
    balance_after: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)

    item: Mapped[StockItem] = relationship(back_populates="movements")


class PurchaseOrder(Base, TimestampMixin):
    """Raised by the reorder rule, approved by a human, received by the store."""

    __tablename__ = "purchase_orders"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    item_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.stock_items.id"), nullable=False, index=True
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    supplier: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(
        String(16), default=PurchaseStatus.SUGGESTED, nullable=False, index=True
    )
    expected_on: Mapped[date | None] = mapped_column(Date)
    approved_by: Mapped[UUID | None] = uuid_ref()
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Why the engine thought this was needed — shown on the action card.
    rationale: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
