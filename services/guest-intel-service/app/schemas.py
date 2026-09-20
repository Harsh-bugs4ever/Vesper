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
    # The staff-only Bayesian average. Null until enough people have reviewed.
    score: float | None = None
    # That plus what the guest themselves did. Guest feedback can only raise it — a
    # complaint is information, not misbehaviour, and never subtracts.
    final_score: float | None = None
    engagement_bonus: float = 0.0
    # The guest's own sentiment toward us. Shown beside the score, never inside it: a
    # guest who rated us badly is a retention question, not a bad guest.
    guest_sentiment: float = 0.0
    # A low staff score on a guest who complained — read the reviews before acting.
    possible_retaliation: bool = False
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


class StaffReviewCreate(BaseModel):
    """What a guest submits about a member of staff who served them."""

    staff_id: UUID
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)
    # The request or order this rating followed, when it came from one.
    request_id: UUID | None = None


class StaffReviewOut(ORMModel):
    id: UUID
    stay_id: UUID
    staff_id: UUID
    department_id: UUID | None = None
    rating: int
    comment: str | None = None
    sentiment_score: float
    sentiment_label: str
    # True when the guest had an open complaint at the time. Recorded so the score can
    # say so, rather than counting a rating given mid-problem as a clean read.
    during_complaint: bool
    created_at: datetime


class StaffReviewForGuest(ORMModel):
    """The same review as the guest who wrote it may see it back.

    Deliberately narrower than `StaffReviewOut`: no sentiment scoring, no complaint
    flag. Those exist so a manager can weigh the rating, and showing a guest how their
    words were scored invites them to write for the scorer.
    """

    id: UUID
    staff_id: UUID
    rating: int
    comment: str | None = None
    created_at: datetime


class StaffPerformanceOut(ORMModel):
    staff_id: UUID
    department_id: UUID | None = None
    review_count: int
    mean_rating: float | None = None
    # Recency-weighted, severity-corrected Bayesian average. Null until four separate
    # guests have rated this person.
    score: float | None = None
    confidence: float
    tier: str
    reasons: list[str]
    complaint_context_reviews: int
    # Scored, but on too few guests to rank with confidence.
    thin_evidence: bool
    deserves_recognition: bool
    # A manager should read the comments. Never an automatic consequence.
    merits_a_conversation: bool
    computed_at: datetime | None = None


class StaffPerformanceBoard(BaseModel):
    """The board, and the people who are not on it.

    Two lists rather than one: appending unrated staff to the bottom of a descending
    table reads as "worst", and "nobody has rated them yet" is not a ranking.
    """

    ranked: list[StaffPerformanceOut]
    unranked: list[StaffPerformanceOut]
    house_average: float
    minimum_reviews_for_score: int


class StaffPerformanceDetail(StaffPerformanceOut):
    reviews: list[StaffReviewOut]


class RateableStaff(BaseModel):
    """Someone the guest may rate, because they actually served this stay."""

    id: UUID
    name: str
    role: str | None = None
    department_id: UUID | None = None
    already_rated: bool = False
