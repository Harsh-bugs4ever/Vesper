from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .models import AttendanceMethod, TaskPriority, TaskSource, TaskStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ShiftOut(ORMModel):
    id: UUID
    key: str
    name: str
    starts_at: time
    ends_at: time
    grace_minutes: int


class CheckInRequest(BaseModel):
    shift_id: UUID | None = None
    method: AttendanceMethod = AttendanceMethod.QR
    # Signed payload from the wall-mounted attendance QR, or a GPS fix.
    qr_token: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    note: str | None = None


class CheckOutRequest(BaseModel):
    note: str | None = None


class AttendanceOut(ORMModel):
    id: UUID
    user_id: UUID
    department_id: UUID | None = None
    shift_id: UUID
    work_date: date
    checked_in_at: datetime
    checked_out_at: datetime | None = None
    method: str
    is_late: bool
    late_by_minutes: int
    worked_minutes: int
    note: str | None = None


class AttendanceSummary(BaseModel):
    """The manager's team view for one day."""

    work_date: date
    expected: int
    present: int
    late: int
    absent: int
    still_on_shift: int
    records: list[AttendanceOut]


class TaskOut(ORMModel):
    id: UUID
    title: str
    description: str | None = None
    department_id: UUID
    assignee_id: UUID | None = None
    room_id: UUID | None = None
    status: str
    priority: str
    source: str
    source_ref: UUID | None = None
    due_at: datetime | None = None
    accepted_at: datetime | None = None
    completed_at: datetime | None = None
    meta: dict


class TaskDetail(TaskOut):
    is_overdue: bool


class TaskCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    department_id: UUID
    description: str | None = None
    assignee_id: UUID | None = None
    room_id: UUID | None = None
    priority: TaskPriority = TaskPriority.NORMAL
    source: TaskSource = TaskSource.MANUAL
    source_ref: UUID | None = None
    due_in_minutes: int | None = Field(default=None, ge=1, le=60 * 24)
    meta: dict = Field(default_factory=dict)


class TaskAssign(BaseModel):
    assignee_id: UUID


class TaskStatusUpdate(BaseModel):
    status: TaskStatus
    note: str | None = None


class TaskBoard(BaseModel):
    counts: dict[str, int]
    overdue: int
    tasks: list[TaskDetail]


class TeamProgress(BaseModel):
    department_id: UUID
    open_tasks: int
    in_progress: int
    done_today: int
    overdue: int


class ReportCreate(BaseModel):
    department_id: UUID
    category: str = Field(pattern=r"^(room_defect|service|safety|supplies|general)$")
    summary: str = Field(min_length=3, max_length=160)
    description: str | None = None
    severity: str = Field(default="normal", pattern=r"^(low|normal|high)$")
    room_id: UUID | None = None
    evidence: list[str] = Field(default_factory=list, max_length=10)


class ReportOut(ORMModel):
    id: UUID
    department_id: UUID
    reporter_department_id: UUID | None = None
    responsible_manager_id: UUID | None = None
    reported_by: UUID | None = None
    category: str
    summary: str
    description: str | None = None
    severity: str
    evidence: list[str]
    status: str
    room_id: UUID | None = None
    work_order_id: UUID | None = None
    created_at: datetime
