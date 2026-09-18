from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm
from vesper_common.security import Principal, current_user, requires

from . import service
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
)

attendance_router = APIRouter(prefix="/attendance", tags=["attendance"])
tasks_router = APIRouter(prefix="/tasks", tags=["tasks"])


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
    """A supervisor sees their own department unless they ask for another and may."""
    scope = department_id
    if scope is None and principal.department_id:
        scope = UUID(principal.department_id)
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
    return [_detail(t) for t in tasks]


@tasks_router.get("", response_model=TaskBoard)
def list_tasks(
    department_id: UUID | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    room_id: UUID | None = None,
    include_done: bool = False,
    principal: Principal = Depends(requires(Perm.TASKS_READ)),
    db: Session = Depends(get_session),
) -> TaskBoard:
    tasks = service.list_tasks(
        db,
        UUID(principal.property_id),
        department_id=department_id,
        status=status_filter,
        room_id=room_id,
        include_done=include_done,
    )
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
    task = service.create_task(db, UUID(principal.property_id), body, actor_id=principal.id)
    return _detail(task)


@tasks_router.get("/overdue", response_model=list[TaskDetail])
def overdue(
    principal: Principal = Depends(requires(Perm.TASKS_ASSIGN)),
    db: Session = Depends(get_session),
) -> list[TaskDetail]:
    return [_detail(t) for t in service.overdue_tasks(db, UUID(principal.property_id))]


@tasks_router.get("/progress/{department_id}", response_model=TeamProgress)
def progress(
    department_id: UUID,
    principal: Principal = Depends(requires(Perm.TASKS_READ)),
    db: Session = Depends(get_session),
) -> TeamProgress:
    return TeamProgress(
        **service.department_progress(db, UUID(principal.property_id), department_id)
    )


@tasks_router.post("/{task_id}/claim", response_model=TaskDetail)
def claim(
    task_id: UUID,
    principal: Principal = Depends(requires(Perm.TASKS_READ)),
    db: Session = Depends(get_session),
) -> TaskDetail:
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
    task = service.update_status(
        db,
        UUID(principal.property_id),
        task_id,
        body.status.value,
        actor_id=principal.id,
        note=body.note,
    )
    return _detail(task)
