from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ForecastOut(ORMModel):
    stay_date: date
    predicted_occupancy: float
    lower_bound: float
    upper_bound: float
    predicted_adr: Decimal
    confidence: float
    # Which model produced this — the UI shows it so a baseline is never mistaken
    # for a fitted Prophet run.
    model_name: str
    features: dict
    generated_at: datetime


class RateNight(BaseModel):
    stay_date: date
    rate: float
    is_override: bool
    source: str
    predicted_occupancy: float | None = None
    confidence: float | None = None


class RateCardRow(BaseModel):
    room_category_id: UUID
    name: str
    base_rate: float
    nights: list[RateNight]


class RateApplyRequest(BaseModel):
    """Per-date, always. A blanket 'set this category's rate' is deliberately absent."""

    room_category_id: UUID
    dates: list[date] = Field(min_length=1)
    rate: Decimal = Field(gt=0)
    source_card_id: UUID | None = None


class RateApplyResult(BaseModel):
    room_category_id: UUID
    applied_dates: list[date]
    rate: float
    # Exactly what to replay to undo this. A null rate means there was no override.
    previous_rates: list[dict]


class RateRestoreRequest(BaseModel):
    previous_rates: list[dict]
    source_card_id: UUID | None = None


class RateHistoryOut(ORMModel):
    id: UUID
    room_category_id: UUID
    stay_date: date
    previous_rate: Decimal | None = None
    new_rate: Decimal
    source: str
    source_card_id: UUID | None = None
    created_at: datetime


class CompetitorRow(BaseModel):
    id: UUID
    name: str
    distance_km: float
    star_rating: int
    rates: dict[str, float]


class SimulateRequest(BaseModel):
    """The owner's three sliders."""

    rate_change_pct: float = Field(default=0.0, ge=-50, le=50)
    staffing_change_pct: float = Field(default=0.0, ge=-50, le=50)
    promo_discount_pct: float = Field(default=0.0, ge=0, le=50)
    days: int = Field(default=30, ge=1, le=90)


class SimulateResult(BaseModel):
    days: int
    baseline_revenue: float
    simulated_revenue: float
    revenue_delta: float
    labour_cost_delta: float
    net_delta: float
    assumptions: dict
    nights: list[dict]
