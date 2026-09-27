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
    safety_stock_days: int
    target_stock_days: int
    average_daily_usage_14d: Decimal
    reorder_threshold: Decimal
    last_threshold_calculated_at: datetime | None = None


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
    lead_time_days: int = 3
    safety_stock_days: int = Field(default=2, ge=0)
    target_stock_days: int = Field(default=14, ge=1)
    expires_on: date | None = None
    department_id: UUID | None = None


class StockItemUpdate(BaseModel):
    name: str | None = None
    minimum_quantity: Decimal | None = None
    reorder_quantity: Decimal | None = None
    unit_cost: Decimal | None = None
    supplier: str | None = None
    lead_time_days: int | None = None
    safety_stock_days: int | None = Field(default=None, ge=0)
    target_stock_days: int | None = Field(default=None, ge=1)
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
    department_id: UUID | None = None
    budget_id: UUID | None = None
    request_line_id: UUID | None = None
    currency: str
    item_id: UUID
    quantity: Decimal
    unit_cost: Decimal
    total_cost: Decimal
    received_quantity: Decimal
    returned_quantity: Decimal
    supplier: str | None = None
    status: str
    expected_on: date | None = None
    approved_at: datetime | None = None
    received_at: datetime | None = None
    rationale: dict
    created_at: datetime


class PurchaseApprove(BaseModel):
    # Set when the manager adjusts what the engine suggested before approving.
    quantity: Decimal | None = Field(default=None, gt=0)


class PurchaseReceive(BaseModel):
    quantity: Decimal | None = Field(default=None, gt=0, decimal_places=3)
    operation_id: UUID | None = None


class PurchaseReturn(BaseModel):
    quantity: Decimal = Field(gt=0, decimal_places=3)
    operation_id: UUID
    reason: str = Field(min_length=3, max_length=500)


class RequisitionLineCreate(BaseModel):
    item_id: UUID
    quantity: Decimal = Field(gt=0, decimal_places=3)
    reason: str = Field(min_length=3, max_length=500)


class RequisitionCreate(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)
    items: list[RequisitionLineCreate] = Field(min_length=1, max_length=50)


class RequisitionDecision(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


class RequisitionLineOut(ORMModel):
    id: UUID
    item_id: UUID
    quantity: Decimal
    unit_cost: Decimal
    reason: str


class RequisitionAuditOut(ORMModel):
    actor_id: UUID
    action: str
    reason: str | None
    created_at: datetime


class RequisitionOut(ORMModel):
    id: UUID
    property_id: UUID
    department_id: UUID
    requested_by: UUID
    responsible_manager_id: UUID
    currency: str
    status: str
    reason: str | None
    decided_by: UUID | None
    decided_at: datetime | None
    decision_reason: str | None
    lines: list[RequisitionLineOut]
    history: list[RequisitionAuditOut]
    created_at: datetime


class BudgetWrite(BaseModel):
    department_id: UUID
    period_start: date
    period_end: date
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    allocated: Decimal = Field(ge=0, decimal_places=2)


class BudgetAllocationUpdate(BaseModel):
    allocated: Decimal = Field(ge=0, decimal_places=2)


class BudgetOut(BaseModel):
    id: UUID
    property_id: UUID
    department_id: UUID
    period_start: date
    period_end: date
    currency: str
    allocated: Decimal
    committed: Decimal
    spent: Decimal
    remaining: Decimal


class InventorySummary(BaseModel):
    total_items: int
    low_stock_items: int
    expiring_items: int
    stock_value: float
    pending_suggestions: int


class ReorderAnalysis(BaseModel):
    item_id: UUID
    current_stock: Decimal
    incoming_stock: Decimal
    reserved_stock: Decimal
    available_stock: Decimal
    consumption_14d: Decimal
    average_daily_usage: Decimal
    supplier_lead_time_days: int
    safety_stock_days: int
    safety_stock: Decimal
    reorder_threshold: Decimal
    target_stock: Decimal
    recommended_quantity: Decimal
    days_remaining: Decimal | None
    requires_reorder: bool
    threshold_source: str
    status: str
    pending_purchase_order_id: UUID | None = None


class ReorderAlert(ReorderAnalysis):
    name: str
    sku: str
    unit: str
