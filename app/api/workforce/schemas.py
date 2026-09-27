from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RosterEntryOut(ORMModel):
    id: UUID
    user_id: UUID
    department_id: UUID
    work_date: date
    shift_key: str


class RosterOut(ORMModel):
    id: UUID
    department_id: UUID | None = None
    week_start: date
    status: str
    # "cp_sat" or "greedy". Shown in the UI so nobody assumes an optimal solve.
    method: str
    objective: str | None = None
    gaps: list
    published_at: datetime | None = None
    notes: str | None = None
    created_at: datetime


class RosterDetail(RosterOut):
    entries: list[RosterEntryOut]


class MyTeamShiftOut(BaseModel):
    work_date: date
    shift_key: str
    shift_name: str
    starts_at: time | None = None
    ends_at: time | None = None


class MyTeamMemberOut(BaseModel):
    user_id: UUID
    full_name: str
    role_title: str
    employee_code: str | None = None
    shifts: list[MyTeamShiftOut] = Field(default_factory=list)


class MyTeamRosterOut(BaseModel):
    department_id: UUID
    department_name: str
    week_start: date
    roster_status: str | None = None
    roster_method: str | None = None
    members: list[MyTeamMemberOut]


class GenerateRosterRequest(BaseModel):
    week_start: date | None = None
    department_id: UUID | None = None


class ApplyAssignmentsRequest(BaseModel):
    """The executor path for a roster-change card."""

    assignments: list[dict] = Field(default_factory=list)
    source_card_id: UUID | None = None
    is_revert: bool = False


class StaffingRow(BaseModel):
    department_id: UUID
    date: date
    shift_key: str
    needed: int
    scheduled: int
    short_by: int


class LeaveOut(ORMModel):
    id: UUID
    user_id: UUID
    from_date: date
    to_date: date
    reason: str | None = None
    status: str
    decided_at: datetime | None = None


class LeaveCreate(BaseModel):
    from_date: date
    to_date: date
    reason: str | None = Field(default=None, max_length=200)


class LeaveDecision(BaseModel):
    approve: bool
