from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .models import MovementReason, StockCategory


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class StockItemOut(ORMModel):
    id: UUID
    sku: str
    name: str
    category: str
    unit: str
    quantity: Decimal
    minimum_quantity: Decimal
    reorder_quantity: Decimal
    unit_cost: Decimal
    expires_on: date | None = None
    supplier: str | None = None
    lead_time_days: int


class StockItemDetail(StockItemOut):
    is_low: bool
    days_to_expiry: int | None = None


class StockItemCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=2, max_length=120)
    category: StockCategory
    unit: str = "unit"
    quantity: Decimal = Decimal("0")
    minimum_quantity: Decimal = Decimal("0")
    reorder_quantity: Decimal = Decimal("0")
    unit_cost: Decimal = Decimal("0")
    supplier: str | None = None
    lead_time_days: int = 2
    expires_on: date | None = None
    department_id: UUID | None = None


class StockItemUpdate(BaseModel):
    name: str | None = None
    minimum_quantity: Decimal | None = None
    reorder_quantity: Decimal | None = None
    unit_cost: Decimal | None = None
    supplier: str | None = None
    lead_time_days: int | None = None
    expires_on: date | None = None
    is_active: bool | None = None


class StockMoveRequest(BaseModel):
    """The stock in/out modal. Negative quantity takes stock out."""

    quantity: Decimal
    reason: MovementReason
    note: str | None = None


class StockMovementOut(ORMModel):
    id: UUID
    item_id: UUID
    quantity: Decimal
    reason: str
    note: str | None = None
    balance_after: Decimal
    created_at: datetime


class PurchaseOrderOut(ORMModel):
    id: UUID
    item_id: UUID
    quantity: Decimal
    unit_cost: Decimal
    total_cost: Decimal
    supplier: str | None = None
    status: str
    expected_on: date | None = None
    approved_at: datetime | None = None
    received_at: datetime | None = None
    rationale: dict
    created_at: datetime


class PurchaseApprove(BaseModel):
    # Set when the manager adjusts what the engine suggested before approving.
    quantity: Decimal | None = None


class InventorySummary(BaseModel):
    total_items: int
    low_stock_items: int
    expiring_items: int
    stock_value: float
    pending_suggestions: int
