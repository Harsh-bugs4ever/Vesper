"""Attendance windows, task routing and the manager's team view.

Timezone note (the Day 1 bug): a shift is a property-local wall clock, an attendance
record is an instant. Mixing the two is what made night-shift check-ins land on the wrong
day and every late calculation drift by 5h30m. Everything below converts explicitly.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from vesper_common.clock import as_utc, local_day_bounds, local_today, property_tz, utcnow
from vesper_common.errors import Conflict, Forbidden, Invalid, NotFound
from vesper_common.events import Event, bus

from .models import Attendance, Shift, Task, TaskPriority, TaskSource, TaskStatus

# How long a task gets when nothing else says otherwise. Guest-facing work is tighter
# than internal work because a guest is watching a status bar.
DEFAULT_DUE_MINUTES: dict[str, int] = {
    TaskSource.GUEST_REQUEST: 30,
    TaskSource.CHECKOUT: 45,
    TaskSource.ISSUE: 120,
    TaskSource.ACTION_CARD: 240,
    TaskSource.MANUAL: 120,
    TaskSource.ROSTER: 480,
}

PRIORITY_RANK = {
    TaskPriority.URGENT: 0,
    TaskPriority.HIGH: 1,
    TaskPriority.NORMAL: 2,
    TaskPriority.LOW: 3,
}


# --- shifts and attendance --------------------------------------------------------


def list_shifts(db: Session, property_id: UUID) -> list[Shift]:
    query = select(Shift).where(Shift.property_id == property_id).order_by(Shift.starts_at)
    return list(db.scalars(query))


def get_shift(db: Session, property_id: UUID, shift_id: UUID) -> Shift:
    query = select(Shift).where(Shift.id == shift_id, Shift.property_id == property_id)
    shift = db.scalars(query).first()
    if shift is None:
        raise NotFound("Shift not found")
    return shift


def shift_window(shift: Shift, work_date: date) -> tuple[datetime, datetime]:
    """The UTC instants this shift covers on a given property-local date."""
    tz = property_tz()
    start = datetime.combine(work_date, shift.starts_at, tzinfo=tz)
    end = datetime.combine(work_date, shift.ends_at, tzinfo=tz)
    if shift.crosses_midnight:
        end += timedelta(days=1)
    return as_utc(start), as_utc(end)


def current_shift(db: Session, property_id: UUID, moment: datetime | None = None) -> tuple[Shift, date]:
    """Which shift is someone checking into right now?

    Checked against each shift's own grace window, so an early arrival at 06:50 lands on
    the morning shift rather than being refused.
    """
    moment = as_utc(moment or utcnow())
    today = moment.astimezone(property_tz()).date()
    best: tuple[Shift, date] | None = None
    best_distance: float | None = None
    for shift in list_shifts(db, property_id):
        for work_date in (today - timedelta(days=1), today):
            start, end = shift_window(shift, work_date)
            if start - timedelta(minutes=shift.grace_minutes) <= moment <= end:
                distance = abs((moment - start).total_seconds())
                if best_distance is None or distance < best_distance:
                    best, best_distance = (shift, work_date), distance
    if best is None:
        raise Invalid("No shift is open right now — ask a manager to mark you in")
    return best


def check_in(
    db: Session,
    property_id: UUID,
    user_id: UUID,
    *,
    department_id: UUID | None,
    data,
) -> Attendance:
    now = utcnow()
    if data.shift_id:
        shift = get_shift(db, property_id, data.shift_id)
        work_date = now.astimezone(property_tz()).date()
        start, end = shift_window(shift, work_date)
        if now > end:  # they picked today's shift after it ended; assume yesterday's
            work_date -= timedelta(days=1)
            start, _ = shift_window(shift, work_date)
    else:
        shift, work_date = current_shift(db, property_id, now)
        start, _ = shift_window(shift, work_date)

    existing = db.scalars(
        select(Attendance).where(
            Attendance.user_id == user_id,
            Attendance.shift_id == shift.id,
            Attendance.work_date == work_date,
        )
    ).first()
    if existing is not None:
        # Check-in is idempotent. Mobile clients can retry after a slow response, and
        # returning the active attendance record lets them recover the real shift state.
        if existing.checked_out_at is None:
            return existing
        raise Conflict("Your check-in for this shift has already been closed")

    late_by = max(0, int((now - start).total_seconds() // 60) - shift.grace_minutes)
    record = Attendance(
        property_id=property_id,
        user_id=user_id,
        department_id=department_id,
        shift_id=shift.id,
        work_date=work_date,
        checked_in_at=now,
        method=data.method.value,
        is_late=late_by > 0,
        late_by_minutes=late_by,
        latitude=data.latitude,
        longitude=data.longitude,
        note=data.note,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    bus.publish(
        Event.ATTENDANCE_MARKED,
        {
            "attendance_id": str(record.id),
            "user_id": str(user_id),
            "department_id": str(department_id) if department_id else None,
            "shift": shift.key,
            "direction": "in",
            "is_late": record.is_late,
            "late_by_minutes": late_by,
        },
        property_id=str(property_id),
        actor_id=str(user_id),
    )
    return record


def check_out(db: Session, property_id: UUID, user_id: UUID, *, note: str | None = None) -> Attendance:
    record = db.scalars(
        select(Attendance)
        .where(
            Attendance.property_id == property_id,
            Attendance.user_id == user_id,
            Attendance.checked_out_at.is_(None),
        )
        .order_by(Attendance.checked_in_at.desc())
    ).first()
    if record is None:
        raise Conflict("You are not checked in")

    now = utcnow()
    record.checked_out_at = now
    record.worked_minutes = int((now - as_utc(record.checked_in_at)).total_seconds() // 60)
    if note:
        record.note = note
    db.commit()
    db.refresh(record)

    bus.publish(
        Event.ATTENDANCE_MARKED,
        {
            "attendance_id": str(record.id),
            "user_id": str(user_id),
            "direction": "out",
            "worked_minutes": record.worked_minutes,
        },
        property_id=str(property_id),
        actor_id=str(user_id),
    )
    return record


def my_attendance(db: Session, property_id: UUID, user_id: UUID, *, days: int = 14) -> list[Attendance]:
    since = local_today() - timedelta(days=days)
    query = (
        select(Attendance)
        .where(
            Attendance.property_id == property_id,
            Attendance.user_id == user_id,
            Attendance.work_date >= since,
        )
        .order_by(Attendance.checked_in_at.desc())
    )
    return list(db.scalars(query))


def team_attendance(
    db: Session,
    property_id: UUID,
    *,
    department_id: UUID | None,
    work_date: date | None,
    expected_headcount: int = 0,
) -> dict:
    day = work_date or local_today()
    query = select(Attendance).where(
        Attendance.property_id == property_id, Attendance.work_date == day
    )
    if department_id:
        query = query.where(Attendance.department_id == department_id)
    records = list(db.scalars(query.order_by(Attendance.checked_in_at)))

    present = len(records)
    late = sum(1 for r in records if r.is_late)
    on_shift = sum(1 for r in records if r.checked_out_at is None)
    return {
        "work_date": day,
        "expected": expected_headcount or present,
        "present": present,
        "late": late,
        "absent": max(0, (expected_headcount or present) - present),
        "still_on_shift": on_shift,
        "records": records,
    }


# --- tasks ------------------------------------------------------------------------


def create_task(
    db: Session,
    property_id: UUID,
    data,
    *,
    actor_id: str | None = None,
    sla_minutes: int | None = None,
) -> Task:
    source = data.source.value if hasattr(data.source, "value") else data.source
    if data.source_ref is not None:
        existing = db.scalars(select(Task).where(Task.property_id == property_id,
            Task.source == source, Task.source_ref == data.source_ref)).first()
        if existing is not None:
            return existing
    minutes = data.due_in_minutes or sla_minutes or DEFAULT_DUE_MINUTES.get(data.source, 120)
    task = Task(
        property_id=property_id,
        department_id=data.department_id,
        assignee_id=data.assignee_id,
        room_id=data.room_id,
        title=data.title,
        description=data.description,
        priority=data.priority.value if hasattr(data.priority, "value") else data.priority,
        source=source,
        source_ref=data.source_ref,
        status=TaskStatus.ASSIGNED if data.assignee_id else TaskStatus.OPEN,
        due_at=utcnow() + timedelta(minutes=minutes),
        meta=data.meta,
    )
    db.add(task)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if data.source_ref is not None:
            existing = db.scalars(select(Task).where(Task.property_id == property_id,
                Task.source == source, Task.source_ref == data.source_ref)).first()
            if existing is not None:
                return existing
        raise
    db.refresh(task)

    bus.publish(
        Event.TASK_CREATED,
        _task_payload(task),
        property_id=str(property_id),
        actor_id=actor_id,
    )
    return task


def get_task(db: Session, property_id: UUID, task_id: UUID) -> Task:
    query = select(Task).where(Task.id == task_id, Task.property_id == property_id)
    task = db.scalars(query).first()
    if task is None:
        raise NotFound("Task not found")
    return task


def list_tasks(
    db: Session,
    property_id: UUID,
    *,
    assignee_id: UUID | None = None,
    department_id: UUID | None = None,
    status: str | None = None,
    room_id: UUID | None = None,
    include_done: bool = False,
    limit: int = 200,
) -> list[Task]:
    query = select(Task).where(Task.property_id == property_id)
    if assignee_id:
        query = query.where(Task.assignee_id == assignee_id)
    if department_id:
        query = query.where(Task.department_id == department_id)
    if room_id:
        query = query.where(Task.room_id == room_id)
    if status:
        query = query.where(Task.status == status)
    elif not include_done:
        query = query.where(Task.status.notin_([TaskStatus.DONE, TaskStatus.CANCELLED]))

    tasks = list(db.scalars(query.limit(limit)))
    # Sort in Python: the phone list is short and "urgent first, then most overdue"
    # is clearer here than as a SQL CASE expression.
    tasks.sort(key=lambda t: (PRIORITY_RANK.get(t.priority, 9), t.due_at or utcnow()))
    return tasks


def assign_task(db: Session, property_id: UUID, task_id: UUID, assignee_id: UUID, actor_id: str) -> Task:
    task = db.scalars(select(Task).where(Task.id == task_id, Task.property_id == property_id).with_for_update()).first()
    if task is None:
        raise NotFound("Task not found")
    if task.status in {TaskStatus.DONE, TaskStatus.CANCELLED}:
        raise Conflict("That task is already closed")
    if task.assignee_id != assignee_id:
        task.status = TaskStatus.ASSIGNED
        task.accepted_at = None
    task.assignee_id = assignee_id
    db.commit()
    db.refresh(task)
    bus.publish(Event.TASK_ASSIGNED, _task_payload(task), property_id=str(property_id), actor_id=actor_id)
    return task


def assign_next_task(db: Session, property_id: UUID, department_id: UUID,
                     user_id: UUID, actor_id: str) -> Task | None:
    """Give the just-finished staff member the next open task, if any."""
    task = db.scalars(
        select(Task)
        .where(
            Task.property_id == property_id,
            Task.department_id == department_id,
            Task.status == TaskStatus.OPEN,
            Task.assignee_id.is_(None),
        )
        .order_by(Task.due_at.asc().nulls_last(), Task.created_at.asc())
        .with_for_update(skip_locked=True)
        .limit(1)
    ).first()
    if task is None:
        return None
    task.assignee_id = user_id
    task.status = TaskStatus.ASSIGNED
    task.accepted_at = None
    db.commit()
    db.refresh(task)
    bus.publish(Event.TASK_ASSIGNED, _task_payload(task), property_id=str(property_id), actor_id=actor_id)
    return task


def update_status(
    db: Session, property_id: UUID, task_id: UUID, new_status: str, *, actor_id: str, note: str | None = None,
    allow_supervisor: bool = False, department_ids: set[UUID] | None = None,
) -> Task:
    task = db.scalars(select(Task).where(Task.id == task_id, Task.property_id == property_id).with_for_update()).first()
    if task is None:
        raise NotFound("Task not found")
    if department_ids is not None and task.department_id not in department_ids:
        raise Forbidden("Task is outside your department")
    if task.status == TaskStatus.DONE and new_status == TaskStatus.DONE and (
        allow_supervisor or str(task.completed_by) == actor_id
    ):
        return task
    if task.status in {TaskStatus.DONE, TaskStatus.CANCELLED}:
        raise Conflict("That task is already closed")
    if not allow_supervisor and str(task.assignee_id) != actor_id:
        raise Forbidden("Only the assignee may change this task")
    allowed = {
        TaskStatus.OPEN: {TaskStatus.CANCELLED},
        TaskStatus.ASSIGNED: {TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED},
        TaskStatus.IN_PROGRESS: {TaskStatus.DONE, TaskStatus.CANCELLED},
    }
    if new_status not in allowed.get(task.status, set()):
        raise Conflict(f"Cannot move a task from {task.status} to {new_status}")
    if new_status == TaskStatus.DONE and task.assignee_id is None:
        raise Conflict("An unassigned task cannot be completed")

    task.status = new_status
    if new_status == TaskStatus.IN_PROGRESS:
        task.accepted_at = task.accepted_at or utcnow()
    elif new_status == TaskStatus.DONE:
        task.completed_at = utcnow()
        task.completed_by = UUID(actor_id)
    elif new_status == TaskStatus.CANCELLED:
        task.cancel_reason = note
    db.commit()
    db.refresh(task)

    if new_status == TaskStatus.DONE:
        payload = _task_payload(task)
        payload["minutes_to_complete"] = int(
            (as_utc(task.completed_at) - as_utc(task.created_at)).total_seconds() // 60
        )
        # Inventory listens for this to deduct stock on a delivered room-service order.
        bus.publish(Event.TASK_COMPLETED, payload, property_id=str(property_id), actor_id=actor_id)
    return task


def department_progress(db: Session, property_id: UUID, department_id: UUID) -> dict:
    start, end = local_day_bounds(local_today())
    base = select(func.count()).select_from(Task).where(
        Task.property_id == property_id, Task.department_id == department_id
    )
    open_tasks = db.scalar(base.where(Task.status == TaskStatus.OPEN)) or 0
    in_progress = db.scalar(base.where(Task.status == TaskStatus.IN_PROGRESS)) or 0
    done_today = (
        db.scalar(
            base.where(
                Task.status == TaskStatus.DONE,
                Task.completed_at >= start,
                Task.completed_at < end,
            )
        )
        or 0
    )
    overdue = (
        db.scalar(
            base.where(
                Task.status.notin_([TaskStatus.DONE, TaskStatus.CANCELLED]),
                Task.due_at < utcnow(),
            )
        )
        or 0
    )
    return {
        "department_id": department_id,
        "open_tasks": open_tasks,
        "in_progress": in_progress,
        "done_today": done_today,
        "overdue": overdue,
    }


def overdue_tasks(db: Session, property_id: UUID) -> list[Task]:
    query = select(Task).where(
        Task.property_id == property_id,
        Task.status.notin_([TaskStatus.DONE, TaskStatus.CANCELLED]),
        Task.due_at < utcnow(),
    )
    return list(db.scalars(query.order_by(Task.due_at)))


def _task_payload(task: Task) -> dict:
    return {
        "task_id": str(task.id),
        "title": task.title,
        "department_id": str(task.department_id),
        "assignee_id": str(task.assignee_id) if task.assignee_id else None,
        "room_id": str(task.room_id) if task.room_id else None,
        "status": task.status,
        "priority": task.priority,
        "source": task.source,
        "source_ref": str(task.source_ref) if task.source_ref else None,
        "due_at": task.due_at.isoformat() if task.due_at else None,
        "meta": task.meta,
    }
