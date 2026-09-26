from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from vesper_common.db import get_session
from vesper_common.permissions import Perm, Role
from vesper_common.errors import Forbidden, NotFound
from app.api.identity.models import User
from app.api.action.models import ActionCard
from .models import LeaveRequest
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
    principal.require(Perm.ROSTER_APPROVE)
    rows = service.list_rosters(db, UUID(principal.property_id), status=status_filter)
    return [RosterOut.model_validate(r) for r in rows if principal.role in {Role.GM, "service"} or principal.can_see_department(r.department_id)]


@router.post("/rosters/generate", response_model=RosterDetail, status_code=status.HTTP_201_CREATED)
def generate_roster(
    body: GenerateRosterRequest,
    request: Request,
    principal: Principal = Depends(requires(Perm.ROSTER_APPROVE)),
    db: Session = Depends(get_session),
) -> RosterDetail:
    if body.department_id is not None:
        principal.require_department_record(db, body.department_id)
    """Build a draft roster for a week from the demand forecast and who is available.

    Always a draft: an auto-generated roster never becomes the one people turn up to
    until a human publishes it.
    """
    roster = service.generate_roster(
        db,
        UUID(principal.property_id),
        week_start=body.week_start,
        department_id=principal.scoped_department(body.department_id),
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
    principal.require(Perm.ROSTER_APPROVE)
    roster = service.current_roster(db, UUID(principal.property_id), week_start)
    if roster and principal.role not in {Role.GM, "service"}:
        principal.require_object(roster)
    return _detail(roster) if roster else None


@router.post("/roster/apply", response_model=dict)
def apply_assignments(
    body: ApplyAssignmentsRequest,
    principal: Principal = Depends(requires(Perm.ROSTER_APPROVE)),
    db: Session = Depends(get_session),
) -> dict:
    """Executor path for a roster-change card; returns what to replay on undo."""
    if body.source_card_id is not None:
        card = db.get(ActionCard, body.source_card_id)
        if card is None or str(card.property_id) != principal.property_id:
            raise NotFound("Action card not found")
        principal.require_object(card)
    for assignment in body.assignments:
        principal.require_department_record(db, assignment.get("department_id"))
        roster_id = assignment.get("roster_id")
        if not roster_id:
            raise Forbidden("Roster ID required")
        roster = service.get_roster(db, UUID(principal.property_id), UUID(str(roster_id)))
        principal.require_object(roster)
        if roster.department_id is not None and str(roster.department_id) != str(assignment["department_id"]):
            raise Forbidden("Roster department mismatch")
        user = db.get(User, UUID(str(assignment["user_id"])))
        if user is None or not any(str(a.property_id) == principal.property_id and str(a.department_id) == str(assignment["department_id"]) for a in user.assignments):
            raise Forbidden("Assignee is outside the roster department")
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
    principal.require(Perm.ROSTER_APPROVE)
    roster = service.get_roster(db, UUID(principal.property_id), roster_id)
    principal.require_object(roster)
    return _detail(roster)


@router.post("/rosters/{roster_id}/publish", response_model=RosterDetail)
def publish_roster(
    roster_id: UUID,
    principal: Principal = Depends(requires(Perm.ROSTER_APPROVE)),
    db: Session = Depends(get_session),
) -> RosterDetail:
    principal.require_object(service.get_roster(db, UUID(principal.property_id), roster_id))
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
    principal.require(Perm.ROSTER_APPROVE)
    principal.require_object(service.get_roster(db, UUID(principal.property_id), roster_id))
    return [
        StaffingRow(**row)
        for row in service.staffing_chart(db, UUID(principal.property_id), roster_id)
        if principal.can_see_department(row["department_id"])
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
    if principal.role in {Role.GM, "service"}:
        return [LeaveOut.model_validate(r) for r in rows]
    allowed_users = {u.id for u in db.scalars(select(User).where(User.id.in_([r.user_id for r in rows]))).all() if any(str(a.property_id) == principal.property_id and principal.can_see_department(a.department_id) for a in u.assignments)}
    return [LeaveOut.model_validate(r) for r in rows if r.user_id == UUID(principal.id) or r.user_id in allowed_users]


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
    row_before = db.get(LeaveRequest, leave_id)
    if row_before is None or str(row_before.property_id) != principal.property_id:
        raise NotFound("Leave request not found")
    user = db.get(User, row_before.user_id)
    if user is None or not any(str(a.property_id) == principal.property_id and principal.can_see_department(a.department_id) for a in user.assignments):
        raise Forbidden("Leave request is outside your departments")
    row = service.decide_leave(
        db, UUID(principal.property_id), leave_id, approve=body.approve, actor_id=UUID(principal.id)
    )
    return LeaveOut.model_validate(row)
