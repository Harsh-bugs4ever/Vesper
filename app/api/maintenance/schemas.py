from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .models import WorkOrderKind, WorkOrderStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AssetHealthOut(ORMModel):
    asset_id: UUID
    risk_score: float
    confidence: float
    drivers: list
    # Named so the UI can say which detector produced this, never implying more.
    method: str
    anomaly_count: int
    trend_per_day: float
    readings_considered: int
    anomalies: list
    assessed_at: datetime


class WorkOrderOut(ORMModel):
    id: UUID
    asset_id: UUID | None = None
    room_id: UUID | None = None
    source_issue_id: UUID | None = None
    department_id: UUID | None = None
    source_card_id: UUID | None = None
    task_id: UUID | None = None
    title: str
    description: str | None = None
    kind: str
    status: str
    priority: str
    scheduled_for: date | None = None
    scheduling_rationale: dict
    completed_at: datetime | None = None
    estimated_cost: Decimal
    actual_cost: Decimal | None = None
    notes: str | None = None
    created_at: datetime


class WorkOrderCreate(BaseModel):
    asset_id: UUID
    title: str = Field(min_length=3, max_length=180)
    description: str | None = None
    kind: WorkOrderKind = WorkOrderKind.PREVENTIVE
    priority: str = "normal"
    department_id: UUID | None = None
    scheduled_for: date | None = None
    scheduling_rationale: dict = Field(default_factory=dict)
    estimated_cost: Decimal = Decimal("0")


class WorkOrderComplete(BaseModel):
    actual_cost: Decimal | None = None
    notes: str | None = None


class WorkOrderStatusUpdate(BaseModel):
    status: WorkOrderStatus


class MaintenanceSummary(BaseModel):
    assets_assessed: int
    assets_at_risk: int
    open_work_orders: int
    scheduled_work_orders: int
    highest_risk: float
