from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm, Role
from vesper_common.security import Principal, current_user, requires
from app.api.identity.models import User
from app.api.property.models import Room
from vesper_common.errors import Forbidden

from . import service, reporting
from .schemas import (
    AttendanceOut,
    AttendanceSummary,
    CheckInRequest,
    CheckOutRequest,
    ShiftOut,
    TaskAssign,
    TaskBoard,
    TaskCreate,
    TaskDetail,
    TaskOut,
    TaskStatusUpdate,
    TeamProgress,
    ReportCreate,
    ReportOut,
)

attendance_router = APIRouter(prefix="/attendance", tags=["attendance"])
tasks_router = APIRouter(prefix="/tasks", tags=["tasks"])
reports_router = APIRouter(prefix="/reports", tags=["staff-reports"])


def _detail(task) -> TaskDetail:
    return TaskDetail(**TaskOut.model_validate(task).model_dump(), is_overdue=task.is_overdue)


@attendance_router.get("/shifts", response_model=list[ShiftOut])
def list_shifts(
    principal: Principal = Depends(current_user), db: Session = Depends(get_session)
) -> list[ShiftOut]:
    return [ShiftOut.model_validate(s) for s in service.list_shifts(db, UUID(principal.property_id))]


@attendance_router.post("/check-in", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
def check_in(
    body: CheckInRequest,
    principal: Principal = Depends(requires(Perm.ATTENDANCE_MARK)),
    db: Session = Depends(get_session),
) -> AttendanceOut:
    record = service.check_in(
        db,
        UUID(principal.property_id),
        UUID(principal.id),
        department_id=UUID(principal.department_id) if principal.department_id else None,
        data=body,
    )
    return AttendanceOut.model_validate(record)


@attendance_router.post("/check-out", response_model=AttendanceOut)
def check_out(
    body: CheckOutRequest,
    principal: Principal = Depends(requires(Perm.ATTENDANCE_MARK)),
    db: Session = Depends(get_session),
) -> AttendanceOut:
    record = service.check_out(
        db, UUID(principal.property_id), UUID(principal.id), note=body.note
    )
    return AttendanceOut.model_validate(record)


@attendance_router.get("/me", response_model=list[AttendanceOut])
def my_attendance(
    days: int = Query(default=14, ge=1, le=90),
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> list[AttendanceOut]:
    rows = service.my_attendance(db, UUID(principal.property_id), UUID(principal.id), days=days)
    return [AttendanceOut.model_validate(r) for r in rows]


@attendance_router.get("/team", response_model=AttendanceSummary)
def team_attendance(
    department_id: UUID | None = None,
    work_date: date | None = None,
    expected_headcount: int = Query(default=0, ge=0),
    principal: Principal = Depends(requires(Perm.ATTENDANCE_READ_TEAM)),
    db: Session = Depends(get_session),
) -> AttendanceSummary:
    """Team attendance within an assigned department."""
    scope = principal.scoped_department(department_id)
    summary = service.team_attendance(
        db,
        UUID(principal.property_id),
        department_id=scope,
        work_date=work_date,
        expected_headcount=expected_headcount,
    )
    records = [AttendanceOut.model_validate(r) for r in summary["records"]]
    return AttendanceSummary(**{**summary, "records": records})


@tasks_router.get("/mine", response_model=list[TaskDetail])
def my_tasks(
    include_done: bool = False,
    principal: Principal = Depends(requires(Perm.TASKS_READ)),
    db: Session = Depends(get_session),
) -> list[TaskDetail]:
    tasks = service.list_tasks(
        db, UUID(principal.property_id), assignee_id=UUID(principal.id), include_done=include_done
    )
    return [_detail(t) for t in tasks if principal.can_see_department(t.department_id)]


@tasks_router.get("", response_model=TaskBoard)
def list_tasks(
    department_id: UUID | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    room_id: UUID | None = None,
    include_done: bool = False,
    principal: Principal = Depends(requires(Perm.TASKS_READ)),
    db: Session = Depends(get_session),
) -> TaskBoard:
    scope = principal.scoped_department(department_id)
    tasks = service.list_tasks(
        db,
        UUID(principal.property_id),
        department_id=scope,
        status=status_filter,
        room_id=room_id,
        include_done=include_done,
    )
    if principal.role == Role.STAFF:
        tasks = [task for task in tasks if str(task.assignee_id) == principal.id or (
            task.assignee_id is None and principal.can(Perm.TASKS_POOL_READ)
        )]
    counts: dict[str, int] = {}
    for task in tasks:
        counts[task.status] = counts.get(task.status, 0) + 1
    return TaskBoard(
        counts=counts,
        overdue=sum(1 for t in tasks if t.is_overdue),
        tasks=[_detail(t) for t in tasks],
    )


@tasks_router.post("", response_model=TaskDetail, status_code=status.HTTP_201_CREATED)
def create_task(
    body: TaskCreate,
    principal: Principal = Depends(requires(Perm.TASKS_ASSIGN)),
    db: Session = Depends(get_session),
) -> TaskDetail:
    principal.require_department_record(db, body.department_id)
    if body.assignee_id is not None:
        assignee = db.get(User, body.assignee_id)
        if assignee is None or not assignee.is_active or assignee.role.key != Role.STAFF or not any(str(a.property_id) == principal.property_id and a.department_id == body.department_id for a in assignee.assignments):
            raise Forbidden("Assignee is outside the task department")
    if body.room_id is not None:
        room = db.get(Room, body.room_id)
        if room is None or str(room.property_id) != principal.property_id:
            raise Forbidden("Room is outside this property")
    task = service.create_task(db, UUID(principal.property_id), body, actor_id=principal.id)
    return _detail(task)


@tasks_router.get("/overdue", response_model=list[TaskDetail])
def overdue(
    principal: Principal = Depends(requires(Perm.TASKS_ASSIGN)),
    db: Session = Depends(get_session),
) -> list[TaskDetail]:
    return [_detail(t) for t in service.overdue_tasks(db, UUID(principal.property_id)) if principal.can_see_department(t.department_id)]


@tasks_router.get("/progress/{department_id}", response_model=TeamProgress)
def progress(
    department_id: UUID,
    principal: Principal = Depends(requires(Perm.TASKS_READ)),
    db: Session = Depends(get_session),
) -> TeamProgress:
    principal.require(Perm.TASKS_ASSIGN)
    principal.require_department(department_id)
    return TeamProgress(
        **service.department_progress(db, UUID(principal.property_id), department_id)
    )


@tasks_router.post("/{task_id}/claim", response_model=TaskDetail)
def claim(
    task_id: UUID,
    principal: Principal = Depends(requires(Perm.TASKS_READ)),
    db: Session = Depends(get_session),
) -> TaskDetail:
    if principal.role != Role.STAFF:
        raise Forbidden("Task claiming is for assigned staff")
    task = service.get_task(db, UUID(principal.property_id), task_id)
    principal.require_object(task)
    if task.assignee_id is None:
        principal.require(Perm.TASKS_POOL_READ)
    elif str(task.assignee_id) != principal.id:
        raise Forbidden("Task belongs to another staff member")
    return _detail(
        service.claim_task(db, UUID(principal.property_id), task_id, UUID(principal.id))
    )


@tasks_router.put("/{task_id}/assignee", response_model=TaskDetail)
def assign(
    task_id: UUID,
    body: TaskAssign,
    principal: Principal = Depends(requires(Perm.TASKS_ASSIGN)),
    db: Session = Depends(get_session),
) -> TaskDetail:
    task = service.get_task(db, UUID(principal.property_id), task_id)
    principal.require_object(task)
    assignee = db.get(User, body.assignee_id)
    if assignee is None or not assignee.is_active or assignee.role.key != Role.STAFF or not any(str(a.property_id) == principal.property_id and a.department_id == task.department_id for a in assignee.assignments):
        raise Forbidden("Assignee is outside the task department")
    task = service.assign_task(
        db, UUID(principal.property_id), task_id, body.assignee_id, principal.id
    )
    return _detail(task)


@tasks_router.put("/{task_id}/status", response_model=TaskDetail)
def set_status(
    task_id: UUID,
    body: TaskStatusUpdate,
    principal: Principal = Depends(requires(Perm.TASKS_COMPLETE)),
    db: Session = Depends(get_session),
) -> TaskDetail:
    task_row = service.get_task(db, UUID(principal.property_id), task_id)
    principal.require_object(task_row)
    if principal.role == Role.STAFF and str(task_row.assignee_id) != principal.id:
        raise Forbidden("Only the assignee may change this task")
    task = service.update_status(
        db,
        UUID(principal.property_id),
        task_id,
        body.status.value,
        actor_id=principal.id,
        note=body.note,
        allow_supervisor=principal.role in {Role.MANAGER, Role.GM},
    )
    return _detail(task)


@reports_router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def create_report(
    body: ReportCreate,
    principal: Principal = Depends(requires(Perm.REPORTS_WRITE)),
    db: Session = Depends(get_session),
) -> ReportOut:
    principal.require_department_record(db, body.department_id)
    return ReportOut.model_validate(reporting.create_report(
        db, UUID(principal.property_id), UUID(principal.id), body
    ))


@reports_router.get("/mine", response_model=list[ReportOut])
def my_reports(
    principal: Principal = Depends(requires(Perm.REPORTS_WRITE)),
    db: Session = Depends(get_session),
) -> list[ReportOut]:
    rows = reporting.list_reports(db, UUID(principal.property_id), reporter_id=UUID(principal.id))
    return [ReportOut.model_validate(row) for row in rows if principal.can_see_department(row.reporter_department_id)]


@reports_router.get("", response_model=list[ReportOut])
def department_reports(
    department_id: UUID | None = None,
    principal: Principal = Depends(requires(Perm.REPORTS_READ)),
    db: Session = Depends(get_session),
) -> list[ReportOut]:
    scope = principal.scoped_department(department_id)
    rows = reporting.list_reports(db, UUID(principal.property_id), department_id=scope)
    return [ReportOut.model_validate(row) for row in rows]


@reports_router.get("/{report_id}", response_model=ReportOut)
def get_report(
    report_id: UUID,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> ReportOut:
    row = reporting.get_report(db, UUID(principal.property_id), report_id)
    if str(row.reported_by) == principal.id:
        principal.require_department(row.reporter_department_id)
    else:
        principal.require(Perm.REPORTS_READ)
        principal.require_object(row)
    return ReportOut.model_validate(row)


@reports_router.post("/{report_id}/approve", response_model=ReportOut)
def approve_report(
    report_id: UUID,
    principal: Principal = Depends(requires(Perm.REPORTS_APPROVE)),
    db: Session = Depends(get_session),
) -> ReportOut:
    row = reporting.get_report(db, UUID(principal.property_id), report_id)
    principal.require_object(row)
    return ReportOut.model_validate(reporting.approve_report(
        db, UUID(principal.property_id), report_id, UUID(principal.id), "scheduled",
        allow_general_manager=principal.role == Role.GM,
    ))
