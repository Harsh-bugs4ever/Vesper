"""Stock items, movements and purchase orders.

Quantity is never edited directly — every change is a StockMovement, and the item's
on-hand figure is the running total. That is what makes "why is there no bread?" a
question with an answer.
"""
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
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
    RETURN = "return"


class PurchaseStatus(StrEnum):
    SUGGESTED = "suggested"
    APPROVED = "approved"
    ORDERED = "ordered"
    PARTIALLY_RECEIVED = "partially_received"
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
    lead_time_days: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    safety_stock_days: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    target_stock_days: Mapped[int] = mapped_column(Integer, default=14, nullable=False)
    average_daily_usage_14d: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    reorder_threshold: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    last_threshold_calculated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
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
    __table_args__ = (
        Index("ix_stock_movements_reorder_history", "property_id", "item_id", "created_at", "reason"),
        {"schema": SCHEMA},
    )

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    department_id: Mapped[UUID | None] = uuid_ref()
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
    __table_args__ = (
        Index("ix_purchase_orders_incoming_item_status", "property_id", "item_id", "status"),
        {"schema": SCHEMA},
    )

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    # Snapshots, never inferred from the item's current assignment.
    department_id: Mapped[UUID | None] = uuid_ref()
    budget_id: Mapped[UUID | None] = mapped_column(ForeignKey(f"{SCHEMA}.department_budgets.id"))
    request_line_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.inventory_request_lines.id"), unique=True
    )
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    item_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.stock_items.id"), nullable=False, index=True
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    received_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    returned_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    supplier: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(
        String(20), default=PurchaseStatus.SUGGESTED, nullable=False, index=True
    )
    expected_on: Mapped[date | None] = mapped_column(Date)
    approved_by: Mapped[UUID | None] = uuid_ref()
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Why the engine thought this was needed — shown on the action card.
    rationale: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    # A live automatic suggestion owns this key until approval or cancellation.
    reorder_key: Mapped[str | None] = mapped_column(String(80), unique=True)


class InventoryRequest(Base, TimestampMixin):
    __tablename__ = "inventory_requests"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    department_id: Mapped[UUID] = uuid_ref(nullable=False)
    requested_by: Mapped[UUID] = uuid_ref(nullable=False)
    responsible_manager_id: Mapped[UUID] = uuid_ref(nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="submitted", nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[UUID | None] = uuid_ref()
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_reason: Mapped[str | None] = mapped_column(Text)
    lines: Mapped[list["InventoryRequestLine"]] = relationship(
        back_populates="request", cascade="all, delete-orphan", order_by="InventoryRequestLine.id"
    )
    history: Mapped[list["InventoryRequestAudit"]] = relationship(
        back_populates="request", order_by="InventoryRequestAudit.created_at"
    )


class InventoryRequestLine(Base, TimestampMixin):
    __tablename__ = "inventory_request_lines"
    __table_args__ = (CheckConstraint("quantity > 0", name="positive_quantity"), {"schema": SCHEMA})

    id: Mapped[UUID] = uuid_pk()
    request_id: Mapped[UUID] = mapped_column(ForeignKey(f"{SCHEMA}.inventory_requests.id"), nullable=False)
    item_id: Mapped[UUID] = mapped_column(ForeignKey(f"{SCHEMA}.stock_items.id"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    request: Mapped[InventoryRequest] = relationship(back_populates="lines")


class InventoryRequestAudit(Base):
    __tablename__ = "inventory_request_audit"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    request_id: Mapped[UUID] = mapped_column(ForeignKey(f"{SCHEMA}.inventory_requests.id"), nullable=False)
    actor_id: Mapped[UUID] = uuid_ref(nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    request: Mapped[InventoryRequest] = relationship(back_populates="history")


class DepartmentBudget(Base, TimestampMixin):
    __tablename__ = "department_budgets"
    __table_args__ = (
        UniqueConstraint("property_id", "department_id", "period_start", "period_end", "currency"),
        CheckConstraint("period_end >= period_start", name="valid_period"),
        CheckConstraint("allocated >= 0", name="nonnegative_allocation"),
        {"schema": SCHEMA},
    )

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    department_id: Mapped[UUID] = uuid_ref(nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    allocated: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)


class PurchaseOperation(Base):
    __tablename__ = "purchase_operations"
    __table_args__ = (
        UniqueConstraint("order_id", "operation_id"),
        CheckConstraint("quantity > 0", name="positive_quantity"),
        {"schema": SCHEMA},
    )

    id: Mapped[UUID] = uuid_pk()
    order_id: Mapped[UUID] = mapped_column(ForeignKey(f"{SCHEMA}.purchase_orders.id"), nullable=False)
    operation_id: Mapped[UUID] = uuid_ref(nullable=False)
    kind: Mapped[str] = mapped_column(String(12), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    movement_id: Mapped[UUID] = mapped_column(ForeignKey(f"{SCHEMA}.stock_movements.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
