"""Attendance and tasks — what a staff member's phone shows all day.

Shifts are stored as property-local clock times (a morning shift is 07:00 whatever the
server thinks), while every instant — check-in, due, completion — is UTC.
"""
from datetime import datetime, time
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from vesper_common.db import Base, TimestampMixin, uuid_pk, uuid_ref

SCHEMA = "staff"


class TaskStatus(StrEnum):
    OPEN = "open"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"


class TaskPriority(StrEnum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class TaskSource(StrEnum):
    """Where a task came from — the staff app shows a different chip for each."""

    MANUAL = "manual"
    GUEST_REQUEST = "guest_request"
    CHECKOUT = "checkout"
    ISSUE = "issue"
    ACTION_CARD = "action_card"
    ROSTER = "roster"


class AttendanceMethod(StrEnum):
    QR = "qr"
    LOCATION = "location"
    MANUAL = "manual"


class Shift(Base, TimestampMixin):
    __tablename__ = "shifts"
    __table_args__ = (UniqueConstraint("property_id", "key"), {"schema": SCHEMA})

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    key: Mapped[str] = mapped_column(String(24), nullable=False)
    name: Mapped[str] = mapped_column(String(48), nullable=False)
    starts_at: Mapped[time] = mapped_column(Time, nullable=False)
    ends_at: Mapped[time] = mapped_column(Time, nullable=False)
    # How early someone may check in, and how late before they are marked late.
    grace_minutes: Mapped[int] = mapped_column(Integer, default=15, nullable=False)

    attendance: Mapped[list["Attendance"]] = relationship(back_populates="shift")

    @property
    def crosses_midnight(self) -> bool:
        return self.ends_at <= self.starts_at


class Attendance(Base, TimestampMixin):
    """One row per person per shift per day."""

    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("user_id", "shift_id", "work_date", name="uq_attendance_user_shift_date"),
        {"schema": SCHEMA},
    )

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    user_id: Mapped[UUID] = uuid_ref(nullable=False)
    department_id: Mapped[UUID | None] = uuid_ref()
    shift_id: Mapped[UUID] = mapped_column(ForeignKey(f"{SCHEMA}.shifts.id"), nullable=False)

    # The property-local calendar day the shift belongs to, so a 22:00-06:00 night shift
    # stays on one row instead of splitting across two dates.
    work_date: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, index=True)
    checked_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    checked_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    method: Mapped[str] = mapped_column(String(16), default=AttendanceMethod.QR, nullable=False)
    is_late: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    late_by_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    worked_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(String(200))

    shift: Mapped[Shift] = relationship(back_populates="attendance")


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[UUID] = uuid_pk()
    property_id: Mapped[UUID] = uuid_ref(nullable=False)
    department_id: Mapped[UUID] = uuid_ref(nullable=False)
    assignee_id: Mapped[UUID | None] = uuid_ref()
    room_id: Mapped[UUID | None] = uuid_ref()

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default=TaskStatus.OPEN, nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(12), default=TaskPriority.NORMAL, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default=TaskSource.MANUAL, nullable=False)
    # The request, issue or card this task was born from — lets the guest's status
    # tracker follow work it never created itself.
    source_ref: Mapped[UUID | None] = uuid_ref()

    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_by: Mapped[UUID | None] = uuid_ref()
    cancel_reason: Mapped[str | None] = mapped_column(String(200))
    meta: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    @property
    def is_overdue(self) -> bool:
        from vesper_common.clock import utcnow

        if self.due_at is None or self.status in {TaskStatus.DONE, TaskStatus.CANCELLED}:
            return False
        return self.due_at < utcnow()
