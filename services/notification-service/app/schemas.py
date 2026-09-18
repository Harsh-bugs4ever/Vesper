from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .models import Channel


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class OutboxOut(ORMModel):
    id: UUID
    channel: str
    recipient: str
    subject: str | None = None
    body: str
    kind: str
    status: str
    attempts: int
    last_error: str | None = None
    next_attempt_at: datetime | None = None
    sent_at: datetime | None = None
    created_at: datetime


class OutboxCreate(BaseModel):
    channel: Channel
    recipient: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1)
    kind: str = Field(default="manual", max_length=48)
    subject: str | None = None
    recipient_user_id: UUID | None = None
    payload: dict = Field(default_factory=dict)


class OutboxSummary(BaseModel):
    pending: int
    sent: int
    failed: int
    dead: int
