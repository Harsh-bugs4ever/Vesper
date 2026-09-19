from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SentimentIn(BaseModel):
    comment: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    guest_id: UUID | None = None
    request_id: UUID | None = None
    department_id: UUID | None = None


class SentimentOut(ORMModel):
    id: UUID
    guest_id: UUID | None = None
    score: float
    label: str
    confidence: float
    # "transformer", "lexicon" or "rating_only" — surfaced so the UI never overclaims.
    method: str
    themes: list[str]
    occurred_on: date


class SentimentSummary(BaseModel):
    samples: int
    average_sentiment: float
    label: str
    negative_share: float = 0.0
    top_themes: list[dict] = Field(default_factory=list)


class GuestDnaOut(ORMModel):
    guest_id: UUID
    preferences: list
    favourite_items: list[str]
    average_sentiment: float
    sentiment_label: str
    complaint_themes: list[str]
    segment: str
    is_at_risk: bool
    risk_score: float
    risk_reasons: list[str]
    typical_gap_days: float | None = None
    days_since_last_visit: int | None = None
    computed_at: datetime


class OfferOut(ORMModel):
    id: UUID
    guest_id: UUID
    offer_type: str
    discount_pct: float
    estimated_value: Decimal
    message: str | None = None
    channel: str
    rationale: str | None = None
    status: str
    sent_at: datetime | None = None
    expires_on: date | None = None
    created_at: datetime


class OfferApprove(BaseModel):
    """The offer composer: the manager writes the message and may retune the discount."""

    message: str | None = Field(default=None, max_length=500)
    discount_pct: float | None = Field(default=None, gt=0, le=50)


class PassageOut(ORMModel):
    id: UUID
    title: str
    content: str
    category: str
    is_active: bool


class PassageCreate(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    content: str = Field(min_length=10)
    category: str = "general"
    is_active: bool = True


class AskRequest(BaseModel):
    question: str = Field(min_length=2, max_length=500)


class ConciergeOut(ORMModel):
    id: UUID
    question: str
    answer: str
    # Which passages the answer came from, so staff can check it.
    sources: list
    model: str | None = None
    outcome: str
    escalated: bool
    escalation_reason: str | None = None
    handled_at: datetime | None = None
    created_at: datetime


class GuestReviewCreate(BaseModel):
    """What a staff member submits about a departing guest."""

    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)


class GuestReviewOut(ORMModel):
    id: UUID
    stay_id: UUID
    guest_id: UUID
    reviewed_by: UUID
    department_id: UUID | None = None
    rating: int
    comment: str | None = None
    sentiment_score: float
    sentiment_label: str
    # True when the reviewer's department is one this guest complained about. Shown to
    # the manager rather than used to silently discount the review.
    is_conflicted: bool
    created_at: datetime


class StayReviewSummaryOut(ORMModel):
    stay_id: UUID
    guest_id: UUID
    room_number: str | None = None
    review_count: int
    mean_rating: float | None = None
    # The Bayesian average the ranking sorts on. Null until enough people have reviewed.
    score: float | None = None
    confidence: float
    tier: str
    departments: dict
    reasons: list[str]
    conflicted_reviews: int
    summary_text: str | None = None
    # "model", "verbatim" or "empty" — stated, never implied.
    summary_method: str
    departs_on: date | None = None
    computed_at: datetime | None = None


class StayReviewDetail(StayReviewSummaryOut):
    reviews: list[GuestReviewOut]
