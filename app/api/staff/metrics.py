"""Staff performance metrics and attendance analytics."""
from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import Integer, case, func, select
from sqlalchemy.orm import Session

from vesper_common.clock import utcnow
from vesper_common.errors import Forbidden
from vesper_common.permissions import Role
from vesper_common.security import Principal

from app.api.identity.models import User, UserAssignment
from app.api.staff.models import Attendance, Task, TaskStatus
from app.api.guest_intel.models import GuestStaffReview


def period(start: date | None = None, end: date | None = None) -> tuple[date, date]:
    """Resolve metric date range, defaulting to the last 30 days."""
    finish = end or date.today()
    begin = start or (finish - timedelta(days=30))
    if begin > finish:
        begin, finish = finish, begin
    return begin, finish


def scope(
    db: Session,
    principal: Principal,
    branch_id: UUID | None = None,
    department_id: UUID | None = None,
    employee_id: UUID | None = None,
    self_only: bool = False,
) -> tuple[UUID, UUID | None]:
    """Authorize and resolve property and department scope."""
    branch = branch_id or UUID(principal.property_id)
    principal.require_property(branch)

    if self_only or (principal.role == Role.STAFF and employee_id is None):
        user = db.get(User, UUID(principal.id))
        dept = user.department_id if user else (UUID(principal.department_id) if principal.department_id else None)
        return branch, dept

    if principal.role == Role.STAFF:
        if employee_id and str(employee_id) != principal.id:
            raise Forbidden("Staff members may only inspect their own metrics")
        user = db.get(User, UUID(principal.id))
        dept = user.department_id if user else (UUID(principal.department_id) if principal.department_id else None)
        return branch, dept

    if department_id is not None:
        if not principal.can_see_department(department_id):
            raise Forbidden("Not authorized for this department")
        return branch, department_id

    if principal.role == Role.MANAGER:
        dept = UUID(principal.department_id) if principal.department_id else None
        return branch, dept

    return branch, None


def employees(
    db: Session,
    branch: UUID,
    department: UUID | None,
    principal: Principal | None = None,
) -> list[dict]:
    """List selectable employees in the authorized scope."""
    query = (
        select(User)
        .where(User.property_id == branch, User.is_active.is_(True))
    )
    if department is not None:
        query = query.where(
            (User.department_id == department)
            | User.assignments.any(UserAssignment.department_id == department)
        )
    if principal and principal.role == Role.STAFF:
        query = query.where(User.id == UUID(principal.id))

    users = db.scalars(query.order_by(User.full_name)).all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "employee_code": u.employee_code or str(u.id)[:8],
        }
        for u in users
    ]


def employee_metrics(
    db: Session,
    branch: UUID,
    employee_id: UUID,
    department: UUID | None,
    begin: date,
    finish: date,
) -> dict:
    """Aggregate attendance, task completion, and guest rating stats for one employee."""
    begin_dt = datetime.combine(begin, datetime.min.time())
    finish_dt = datetime.combine(finish, datetime.max.time())

    # 1. Attendance aggregation
    att_stmt = select(
        func.count(Attendance.id).label("days"),
        func.coalesce(
            func.sum(case((Attendance.is_late.is_(True), 1), else_=0)),
            0,
        ).label("late"),
        func.coalesce(func.sum(Attendance.worked_minutes), 0).label("minutes"),
    ).where(
        Attendance.property_id == branch,
        Attendance.user_id == employee_id,
        Attendance.work_date >= begin_dt,
        Attendance.work_date <= finish_dt,
    )
    att_row = db.execute(att_stmt).one()
    att_days = att_row.days or 0
    late_shifts = att_row.late or 0
    worked_mins = att_row.minutes or 0

    # 2. Task metrics
    task_stmt = select(
        func.count(Task.id).label("assigned"),
        func.coalesce(
            func.sum(case((Task.status == TaskStatus.DONE, 1), else_=0)),
            0,
        ).label("completed"),
    ).where(
        Task.property_id == branch,
        Task.assignee_id == employee_id,
        Task.created_at >= begin_dt,
        Task.created_at <= finish_dt,
    )
    task_row = db.execute(task_stmt).one()
    assigned_tasks = task_row.assigned or 0
    completed_tasks = task_row.completed or 0

    # 3. Guest ratings
    rev_stmt = select(
        func.count(GuestStaffReview.id).label("reviews"),
        func.count(func.distinct(GuestStaffReview.guest_id)).label("distinct_guests"),
        func.avg(GuestStaffReview.rating).label("mean_rating"),
    ).where(
        GuestStaffReview.property_id == branch,
        GuestStaffReview.staff_id == employee_id,
        GuestStaffReview.created_at >= begin_dt,
        GuestStaffReview.created_at <= finish_dt,
    )
    rev_row = db.execute(rev_stmt).one()
    reviews_count = rev_row.reviews or 0
    distinct_reviews = rev_row.distinct_guests or 0
    mean_rating = float(rev_row.mean_rating) if rev_row.mean_rating is not None else None

    dept_id = department
    if dept_id is None:
        emp = db.get(User, employee_id)
        if emp:
            dept_id = emp.department_id

    min_reviews = 4
    data_state = "sufficient" if distinct_reviews >= min_reviews else "provisional"

    return {
        "employee_id": employee_id,
        "branch_id": branch,
        "department_id": dept_id,
        "period_start": begin,
        "period_end": finish,
        "attendance_days": int(att_days),
        "late_shifts": int(late_shifts),
        "worked_minutes": int(worked_mins),
        "assigned_tasks": int(assigned_tasks),
        "completed_tasks": int(completed_tasks),
        "guest_reviews": int(reviews_count),
        "distinct_guest_reviews": int(distinct_reviews),
        "rating_mean": round(mean_rating, 2) if mean_rating is not None else None,
        "minimum_guest_reviews_for_rating": min_reviews,
        "data_state": data_state,
        "generated_at": utcnow(),
    }


def attendance_records(
    db: Session,
    branch: UUID,
    department: UUID | None,
    selected: UUID | None,
    begin: date,
    finish: date,
) -> list[Attendance]:
    """Retrieve filtered attendance logs."""
    begin_dt = datetime.combine(begin, datetime.min.time())
    finish_dt = datetime.combine(finish, datetime.max.time())

    query = select(Attendance).where(
        Attendance.property_id == branch,
        Attendance.work_date >= begin_dt,
        Attendance.work_date <= finish_dt,
    )
    if selected is not None:
        query = query.where(Attendance.user_id == selected)
    elif department is not None:
        query = query.where(Attendance.department_id == department)

    return list(db.scalars(query.order_by(Attendance.work_date.desc(), Attendance.checked_in_at.desc())).all())
