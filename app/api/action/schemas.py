from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .models import CardKind, DismissReason, Urgency


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Driver(BaseModel):
    """One line of the card's reasoning. A manager approves reasons, not numbers."""

    label: str
    detail: str
    weight: float = Field(default=0.0, ge=0.0, le=1.0)


class CardCreate(BaseModel):
    """Posted by an engine. Confidence is the engine's own; action-service scales it
    by what that engine has earned."""

    engine: str
    kind: CardKind
    title: str
    summary: str
    required_permission: str
    drivers: list[Driver] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    impact_amount: Decimal = Decimal("0")
    urgency: Urgency = Urgency.MEDIUM
    department_id: UUID | None = None
    payload: dict = Field(default_factory=dict)
    expires_at: datetime | None = None
    dedupe_key: str | None = None


class CardOut(ORMModel):
    id: UUID
    engine: str
    kind: str
    status: str
    title: str
    summary: str
    drivers: list
    confidence: float
    impact_amount: Decimal
    urgency: str
    score: float
    department_id: UUID | None = None
    required_permission: str
    payload: dict
    adjustments: dict
    claimed_by: UUID | None = None
    decided_at: datetime | None = None
    executed_at: datetime | None = None
    undo_until: datetime | None = None
    snoozed_until: datetime | None = None
    dismiss_reason: str | None = None
    was_shadow: bool
    expires_at: datetime | None = None
    created_at: datetime


class CardDetail(CardOut):
    can_undo: bool
    undo_seconds_left: int


class ApproveRequest(BaseModel):
    """Adjust-and-approve in one call — the modal's Save button."""

    adjustments: dict | None = None


class SnoozeRequest(BaseModel):
    minutes: int = Field(ge=5, le=60 * 24 * 7)


class DismissRequest(BaseModel):
    reason: DismissReason
    note: str | None = Field(default=None, max_length=500)


class OutcomeCreate(BaseModel):
    actual_amount: Decimal
    notes: str | None = None


class OutcomeOut(ORMModel):
    id: UUID
    card_id: UUID
    engine: str
    predicted_amount: Decimal
    actual_amount: Decimal
    accuracy: float
    was_helpful: bool
    notes: str | None = None


class EngineReport(BaseModel):
    engine: str
    cards_raised: int
    cards_approved: int
    cards_dismissed: int
    cards_undone: int
    approval_rate: float | None = None
    outcomes_scored: int
    mean_accuracy: float
    confidence_multiplier: float
    is_cold_start: bool
    outcomes_needed: int


class ReadinessOut(BaseModel):
    engines: list[EngineReport]
    ready_count: int
    total_count: int
    shadow_mode: bool


class AuditOut(ORMModel):
    id: UUID
    actor_id: UUID | None = None
    actor_role: str | None = None
    action: str
    entity_type: str
    entity_id: UUID | None = None
    before: dict
    after: dict
    note: str | None = None
    created_at: datetime


class AuditCreate(BaseModel):
    action: str
    entity_type: str
    entity_id: UUID | None = None
    before: dict = Field(default_factory=dict)
    after: dict = Field(default_factory=dict)
    note: str | None = None


class ActionStats(BaseModel):
    pending_cards: int
    executed_cards: int
    realised_impact: float
    shadow_mode: bool


class DepartmentSnapshot(BaseModel):
    department_id: UUID
    department_name: str
    open_requests: int
    overdue_requests: int
    open_tasks: int
    overdue_tasks: int
    completed_tasks_in_period: int
    attendance_today: int


class OverviewException(BaseModel):
    kind: str
    count: int
    path: str


class FactualInsights(BaseModel):
    source: str
    state: str
    generated_at: datetime
    items: list[str]


class GMOverviewOut(BaseModel):
    branch_id: UUID
    period_start: date
    period_end: date
    generated_at: datetime
    freshness: str
    guests: dict[str, int]
    occupancy: dict[str, int | float | None]
    arrivals_today: int
    departures_today: int
    departments: list[DepartmentSnapshot]
    exceptions: list[OverviewException]
    insights: FactualInsights


class ManagerOverviewOut(BaseModel):
    branch_id: UUID
    period_start: date
    period_end: date
    generated_at: datetime
    department: DepartmentSnapshot
