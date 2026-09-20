"""Rosters, roster entries and leave.

A RosterEntry is one person on one shift on one day. The roster as a whole is a draft
until somebody approves it, so an auto-generated roster never silently becomes the one
people turn up to.
"""
from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from vesper_common.db import Base, TimestampMixin, uuid_pk, uuid_ref

SCHEMA = "workforce"


class RosterStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    SUPERSEDED = "superseded"


class LeaveStatus(StrEnum):
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"


class Roster(Base, TimestampMixin):
    __tablename__ = "rosters"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    department_id: Mapped[UUID | None] = uuid_ref()
    week_start: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(16), default=RosterStatus.DRAFT, nullable=False, index=True
    )
    # "cp_sat" or "greedy" — the UI says which, so nobody assumes optimality.
    method: Mapped[str] = mapped_column(String(16), default="greedy", nullable=False)
    objective: Mapped[str | None] = mapped_column(String(16))
    # Slots the solver could not fill, driving the gap warnings.
    gaps: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    published_by: Mapped[UUID | None] = uuid_ref()
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    entries: Mapped[list["RosterEntry"]] = relationship(
        back_populates="roster", cascade="all, delete-orphan"
    )


class RosterEntry(Base, TimestampMixin):
    __tablename__ = "roster_entries"
    __table_args__ = (
        UniqueConstraint("roster_id", "user_id", "work_date", name="uq_roster_entry_user_date"),
        {"schema": SCHEMA},
    )

    id: Mapped[UUID] = uuid_pk()
    roster_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.rosters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    user_id: Mapped[UUID] = uuid_ref(nullable=False)
    department_id: Mapped[UUID] = uuid_ref(nullable=False)
    work_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    shift_key: Mapped[str] = mapped_column(String(24), nullable=False)

    roster: Mapped[Roster] = relationship(back_populates="entries")


class LeaveRequest(Base, TimestampMixin):
    """Approved leave is a hard constraint — the solver will not roster over it."""

    __tablename__ = "leave_requests"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    user_id: Mapped[UUID] = uuid_ref(nullable=False, index=True)
    from_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    to_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reason: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(
        String(16), default=LeaveStatus.REQUESTED, nullable=False, index=True
    )
    decided_by: Mapped[UUID | None] = uuid_ref()
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
