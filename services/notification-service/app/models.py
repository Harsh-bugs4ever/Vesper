"""The notification outbox.

Every outbound message is a row before it is an attempt. That is what makes "did the
guest actually get the offer?" answerable, and what lets a failed send be retried
instead of quietly lost.
"""
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from vesper_common.db import Base, TimestampMixin, uuid_pk, uuid_ref

SCHEMA = "notification"


class Channel(StrEnum):
    WEBSOCKET = "websocket"
    WHATSAPP = "whatsapp"
    SMS = "sms"
    EMAIL = "email"
    PUSH = "push"


class OutboxStatus(StrEnum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    # Given up on after the retry ceiling. Visible, never deleted.
    DEAD = "dead"


class OutboxMessage(Base, TimestampMixin):
    __tablename__ = "outbox_messages"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    channel: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    # Phone, email or user id, depending on the channel.
    recipient: Mapped[str] = mapped_column(String(160), nullable=False)
    recipient_user_id: Mapped[UUID | None] = uuid_ref()
    subject: Mapped[str | None] = mapped_column(String(180))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # What raised it: "request.overdue", "retention_offer", ...
    kind: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    status: Mapped[str] = mapped_column(
        String(12), default=OutboxStatus.PENDING, nullable=False, index=True
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text)
    # Exponential backoff: nothing is retried before this instant.
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
