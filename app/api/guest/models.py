"""Guests, room QR sessions, service requests, issue reports and ratings.

The guest never logs in. A QR on the nightstand mints a token scoped to one stay in one
room, and every write below re-checks that the stay is still open.
"""
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from vesper_common.db import Base, TimestampMixin, uuid_pk, uuid_ref

SCHEMA = "guest"


class RequestKind(StrEnum):
    ROOM_SERVICE = "room_service"
    HOUSEKEEPING = "housekeeping"
    AMENITIES = "amenities"
    MAINTENANCE = "maintenance"
    OTHER = "other"


class RequestStatus(StrEnum):
    """What the guest's tracker shows, in order."""

    RAISED = "raised"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in_progress"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class IssueStatus(StrEnum):
    REPORTED = "reported"
    MERGED = "merged"
    SCHEDULED = "scheduled"
    RESOLVED = "resolved"


class Guest(Base, TimestampMixin):
    """A person, not a stay. Survives across visits — that is what makes Guest DNA work."""

    __tablename__ = "guests"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str | None] = mapped_column(String(160), index=True)
    phone: Mapped[str | None] = mapped_column(String(24), index=True)
    city: Mapped[str | None] = mapped_column(String(80))
    loyalty_tier: Mapped[str] = mapped_column(String(24), default="none", nullable=False)
    preferences: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(32)), default=list, nullable=False)
    is_vip: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    requests: Mapped[list["ServiceRequest"]] = relationship(back_populates="guest")


class MenuItem(Base, TimestampMixin):
    """What the guest QR page shows. Links to the stock item it consumes."""

    __tablename__ = "menu_items"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    category: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_veg: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    prep_minutes: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # {stock_item_id: quantity} — inventory deducts this when the order is delivered.
    recipe: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)


class ServiceRequest(Base, TimestampMixin):
    __tablename__ = "service_requests"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    stay_id: Mapped[UUID] = uuid_ref(nullable=False)
    room_id: Mapped[UUID] = uuid_ref(nullable=False)
    room_number: Mapped[str] = mapped_column(String(12), nullable=False)
    guest_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.guests.id"), nullable=True, index=True
    )
    department_id: Mapped[UUID | None] = uuid_ref()

    kind: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), default=RequestStatus.RAISED, nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(Text)
    items: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)

    sla_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_by: Mapped[UUID | None] = uuid_ref()
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Set once when the overdue alert fires, so managers are not pinged every minute.
    overdue_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    rating: Mapped[int | None] = mapped_column(Integer)
    rating_comment: Mapped[str | None] = mapped_column(Text)
    rated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    guest: Mapped[Guest | None] = relationship(back_populates="requests")

    @property
    def is_overdue(self) -> bool:
        from vesper_common.clock import utcnow

        if self.status in {RequestStatus.DELIVERED, RequestStatus.CANCELLED}:
            return False
        return self.due_at < utcnow()


class IssueReport(Base, TimestampMixin):
    """Something broken, reported by staff or guest, with a photo.

    Three housekeepers reporting the same dead AC on floor 4 should produce one work
    order, so near-duplicates merge into the first report instead of stacking up.
    """

    __tablename__ = "issue_reports"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    room_id: Mapped[UUID | None] = uuid_ref()
    room_number: Mapped[str | None] = mapped_column(String(12))
    asset_id: Mapped[UUID | None] = uuid_ref()
    department_id: Mapped[UUID | None] = uuid_ref()
    reporter_department_id: Mapped[UUID | None] = uuid_ref()
    responsible_manager_id: Mapped[UUID | None] = uuid_ref()
    evidence: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    work_order_id: Mapped[UUID | None] = uuid_ref()
    reported_by: Mapped[UUID | None] = uuid_ref()
    reported_by_guest: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    summary: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(40), default="general", nullable=False)
    severity: Mapped[str] = mapped_column(String(12), default="normal", nullable=False)
    photo_url: Mapped[str | None] = mapped_column(String(300))

    status: Mapped[str] = mapped_column(String(16), default=IssueStatus.REPORTED, nullable=False, index=True)
    merged_into_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.issue_reports.id"), nullable=True
    )
    duplicate_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class QrScan(Base):
    """Every scan, for the cold-start story and for spotting a photographed QR."""

    __tablename__ = "qr_scans"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    room_id: Mapped[UUID] = uuid_ref(nullable=False)
    stay_id: Mapped[UUID | None] = uuid_ref()
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(200))
    accepted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
