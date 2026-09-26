from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .models import IssueStatus, RequestKind, RequestStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class QrScanRequest(BaseModel):
    """What the guest page posts after reading the nightstand QR."""

    property_id: UUID
    room_id: UUID
    qr_secret: str


class GuestSession(BaseModel):
    """Everything the guest page needs on first paint — no second round trip."""

    token: str
    expires_in: int
    room_number: str
    property_name: str
    guest_name: str | None = None
    stay_id: UUID


class MenuItemOut(ORMModel):
    id: UUID
    category: str
    name: str
    description: str | None = None
    price: Decimal
    is_veg: bool
    prep_minutes: int
    is_available: bool


class MenuOut(BaseModel):
    currency: str
    categories: dict[str, list[MenuItemOut]]


class OrderLine(BaseModel):
    menu_item_id: UUID
    quantity: int = Field(ge=1, le=20)


class RequestCreate(BaseModel):
    kind: RequestKind
    note: str | None = Field(default=None, max_length=500)
    # Only meaningful for room service; ignored for towels and cleaning.
    items: list[OrderLine] = Field(default_factory=list)


class RequestOut(ORMModel):
    id: UUID
    kind: str
    status: str
    room_number: str
    note: str | None = None
    items: list
    total_amount: Decimal
    sla_minutes: int
    due_at: datetime
    accepted_at: datetime | None = None
    delivered_at: datetime | None = None
    rating: int | None = None
    created_at: datetime


class RequestDetail(RequestOut):
    is_overdue: bool
    department_id: UUID | None = None


class RatingCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)


class RequestStatusUpdate(BaseModel):
    status: RequestStatus


class IssueCreate(BaseModel):
    summary: str = Field(min_length=3, max_length=160)
    description: str | None = None
    category: str = "general"
    severity: str = "normal"
    room_id: UUID | None = None
    asset_id: UUID | None = None
    photo_url: str | None = None


class IssueOut(ORMModel):
    id: UUID
    summary: str
    description: str | None = None
    category: str
    severity: str
    status: str
    room_number: str | None = None
    asset_id: UUID | None = None
    photo_url: str | None = None
    duplicate_count: int
    merged_into_id: UUID | None = None
    created_at: datetime


class IssueStatusUpdate(BaseModel):
    status: IssueStatus


class GuestOut(ORMModel):
    id: UUID
    full_name: str
    email: str | None = None
    phone: str | None = None
    city: str | None = None
    loyalty_tier: str
    preferences: dict
    tags: list[str]
    is_vip: bool


class GuestCreate(BaseModel):
    full_name: str
    email: str | None = None
    phone: str | None = None
    city: str | None = None
    loyalty_tier: str = "none"
    preferences: dict = Field(default_factory=dict)


class PhotoUploadOut(BaseModel):
    url: str


class SupportAsk(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    client_message_id: UUID | None = None


class SupportMessageWrite(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    visibility: str = Field(default="guest", pattern="^(guest|internal)$")
    client_message_id: UUID | None = None


class SupportPostOut(ORMModel):
    id: UUID
    author_kind: str
    visibility: str
    body: str
    created_at: datetime


class SupportConversationOut(BaseModel):
    id: UUID
    kind: str
    topic: str
    urgency: str
    status: str
    department_id: UUID | None = None
    escalation_reason: str | None = None
    assigned_owner_id: UUID | None = None
    request_id: UUID | None = None
    acknowledged_at: datetime | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    posts: list[SupportPostOut]
    unread_count: int = 0


class DepartmentThreadCreate(BaseModel):
    department_id: UUID
    topic: str = Field(min_length=1, max_length=48)
    participant_ids: list[UUID] = Field(default_factory=list)


class DelegateRequest(BaseModel):
    assignee_id: UUID


class TopicSummaryOut(BaseModel):
    department_id: UUID | None
    topic: str
    urgency: str
    total: int
    unresolved: int
    oldest_unresolved_hours: int | None
