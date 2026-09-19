"""Bookings, stays and guest visits.

A booking is an intention; a stay is the guest actually in the room. Keeping them apart
is what lets the QR token key off the stay and die at check-out.
"""
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from vesper_common.db import Base, TimestampMixin, uuid_pk, uuid_ref

SCHEMA = "frontdesk"


class BookingStatus(StrEnum):
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class StayStatus(StrEnum):
    IN_HOUSE = "in_house"
    CHECKED_OUT = "checked_out"


class VisitKind(StrEnum):
    """Everywhere a guest spends money or time — the Guest DNA feed."""

    STAY = "stay"
    RESTAURANT = "restaurant"
    SPA = "spa"
    ROOM_SERVICE = "room_service"
    BANQUET = "banquet"


class Booking(Base, TimestampMixin):
    __tablename__ = "bookings"
    __table_args__ = (UniqueConstraint("property_id", "reference"), {"schema": SCHEMA})

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    guest_id: Mapped[UUID] = uuid_ref(nullable=False)
    room_category_id: Mapped[UUID] = uuid_ref(nullable=False)
    # Assigned at check-in, not at booking: the guest books a category, not a door.
    room_id: Mapped[UUID | None] = uuid_ref()

    reference: Mapped[str] = mapped_column(String(24), nullable=False)
    check_in_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    check_out_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    adults: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    children: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="direct", nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), default=BookingStatus.CONFIRMED, nullable=False, index=True
    )
    special_requests: Mapped[str | None] = mapped_column(Text)

    stay: Mapped["Stay | None"] = relationship(back_populates="booking", uselist=False)

    @property
    def nights(self) -> int:
        return max(1, (self.check_out_date - self.check_in_date).days)


class Stay(Base, TimestampMixin):
    """One guest, one room, one occupied period. The guest QR token points here."""

    __tablename__ = "stays"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    booking_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.bookings.id"), nullable=False, index=True
    )
    guest_id: Mapped[UUID] = uuid_ref(nullable=False)
    room_id: Mapped[UUID] = uuid_ref(nullable=False)
    room_number: Mapped[str] = mapped_column(String(12), nullable=False)

    checked_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    checked_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        String(16), default=StayStatus.IN_HOUSE, nullable=False, index=True
    )
    folio_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    booking: Mapped[Booking] = relationship(back_populates="stay")

    @property
    def check_out_date(self) -> date:
        """When this guest is due to leave.

        Lives on the booking, but every caller asking about an in-house stay wants it, so
        it is surfaced here rather than making each one join through.
        """
        return self.booking.check_out_date


class GuestVisit(Base, TimestampMixin):
    """Every touchpoint, not just room nights.

    A guest who eats in the restaurant twice a month but hasn't slept here since March
    is a different retention problem from one who has vanished entirely.
    """

    __tablename__ = "guest_visits"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    guest_id: Mapped[UUID] = uuid_ref(nullable=False)
    stay_id: Mapped[UUID | None] = uuid_ref()
    kind: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    occurred_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    outlet: Mapped[str | None] = mapped_column(String(80))
    meta: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
