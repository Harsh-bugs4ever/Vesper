from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm
from vesper_common.security import Principal, current_user, requires

from . import service
from .schemas import (
    ApplyAssignmentsRequest,
    GenerateRosterRequest,
    LeaveCreate,
    LeaveDecision,
    LeaveOut,
    RosterDetail,
    RosterEntryOut,
    RosterOut,
    StaffingRow,
)

router = APIRouter(prefix="/workforce", tags=["workforce"])


def _detail(roster) -> RosterDetail:
    return RosterDetail(
        **RosterOut.model_validate(roster).model_dump(),
        entries=[RosterEntryOut.model_validate(e) for e in roster.entries],
    )


def _bearer(request: Request) -> str | None:
    """Pass the caller's own token downstream.

    Roster generation reads users, shifts and the forecast from four services. Forwarding
    the real token keeps those reads inside the caller's permissions instead of widening
    them to a service principal.
    """
    header = request.headers.get("authorization", "")
    return header.removeprefix("Bearer ").strip() or None


@router.get("/rosters", response_model=list[RosterOut])
def list_rosters(
    status_filter: str | None = Query(default=None, alias="status"),
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> list[RosterOut]:
    rows = service.list_rosters(db, UUID(principal.property_id), status=status_filter)
    return [RosterOut.model_validate(r) for r in rows]


@router.post("/rosters/generate", response_model=RosterDetail, status_code=status.HTTP_201_CREATED)
def generate_roster(
    body: GenerateRosterRequest,
    request: Request,
    principal: Principal = Depends(requires(Perm.ROSTER_APPROVE)),
    db: Session = Depends(get_session),
) -> RosterDetail:
    """Build a draft roster for a week from the demand forecast and who is available.

    Always a draft: an auto-generated roster never becomes the one people turn up to
    until a human publishes it.
    """
    roster = service.generate_roster(
        db,
        UUID(principal.property_id),
        week_start=body.week_start,
        department_id=body.department_id,
        token=_bearer(request),
    )
    return _detail(roster)


@router.get("/rosters/current", response_model=RosterDetail | None)
def current_roster(
    week_start: date | None = None,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> RosterDetail | None:
    """What the roster grid loads: the published week, else the newest draft."""
    roster = service.current_roster(db, UUID(principal.property_id), week_start)
    return _detail(roster) if roster else None


@router.post("/roster/apply", response_model=dict)
def apply_assignments(
    body: ApplyAssignmentsRequest,
    principal: Principal = Depends(requires(Perm.ROSTER_APPROVE)),
    db: Session = Depends(get_session),
) -> dict:
    """Executor path for a roster-change card; returns what to replay on undo."""
    return service.apply_assignments(
        db,
        UUID(principal.property_id),
        body.assignments,
        source_card_id=body.source_card_id,
        is_revert=body.is_revert,
    )


@router.get("/rosters/{roster_id}", response_model=RosterDetail)
def get_roster(
    roster_id: UUID,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> RosterDetail:
    return _detail(service.get_roster(db, UUID(principal.property_id), roster_id))


@router.post("/rosters/{roster_id}/publish", response_model=RosterDetail)
def publish_roster(
    roster_id: UUID,
    principal: Principal = Depends(requires(Perm.ROSTER_APPROVE)),
    db: Session = Depends(get_session),
) -> RosterDetail:
    roster = service.publish_roster(
        db, UUID(principal.property_id), roster_id, actor_id=UUID(principal.id)
    )
    return _detail(roster)


@router.get("/rosters/{roster_id}/staffing", response_model=list[StaffingRow])
def staffing_chart(
    roster_id: UUID,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> list[StaffingRow]:
    """Needed against scheduled, per shift — the gap chart."""
    return [
        StaffingRow(**row)
        for row in service.staffing_chart(db, UUID(principal.property_id), roster_id)
    ]


@router.get("/leave", response_model=list[LeaveOut])
def list_leave(
    status_filter: str | None = Query(default=None, alias="status"),
    user_id: UUID | None = None,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> list[LeaveOut]:
    # Without permission to see the team, you only see your own.
    scope = user_id
    if not principal.can(Perm.ATTENDANCE_READ_TEAM):
        scope = UUID(principal.id)
    rows = service.list_leave(db, UUID(principal.property_id), status=status_filter, user_id=scope)
    return [LeaveOut.model_validate(r) for r in rows]


@router.post("/leave", response_model=LeaveOut, status_code=status.HTTP_201_CREATED)
def request_leave(
    body: LeaveCreate,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> LeaveOut:
    row = service.request_leave(db, UUID(principal.property_id), UUID(principal.id), body)
    return LeaveOut.model_validate(row)


@router.post("/leave/{leave_id}/decide", response_model=LeaveOut)
def decide_leave(
    leave_id: UUID,
    body: LeaveDecision,
    principal: Principal = Depends(requires(Perm.ROSTER_APPROVE)),
    db: Session = Depends(get_session),
) -> LeaveOut:
    """Approved leave becomes a hard constraint on the next roster solve."""
    row = service.decide_leave(
        db, UUID(principal.property_id), leave_id, approve=body.approve, actor_id=UUID(principal.id)
    )
    return LeaveOut.model_validate(row)
