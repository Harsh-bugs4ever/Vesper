"""Action overview and executive dashboards."""
from datetime import date, datetime, time, timedelta
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from vesper_common.clock import utcnow

from app.api.action.schemas import (
    DepartmentSnapshot,
    FactualInsights,
    GMOverviewOut,
    ManagerOverviewOut,
    OverviewException,
)
from app.api.frontdesk.models import Booking, BookingStatus, Stay, StayStatus
from app.api.guest.models import RequestStatus, ServiceRequest
from app.api.property.models import Department, Room
from app.api.staff.models import Attendance, Task, TaskStatus


def gm_overview(db: Session, branch: UUID, begin: date, finish: date) -> dict:
    """Generate high-performance holistic GM executive overview."""
    now = utcnow()
    today = now.date()
    today_dt = datetime.combine(today, time.min)
    begin_dt = datetime.combine(begin, time.min)
    finish_dt = datetime.combine(finish, time.max)

    # 1. Total rooms and occupied stays
    total_rooms = db.scalar(
        select(func.count(Room.id)).where(Room.property_id == branch)
    ) or 0

    occupied_rooms = db.scalar(
        select(func.count(Stay.id)).where(
            Stay.property_id == branch,
            Stay.status == StayStatus.IN_HOUSE,
        )
    ) or 0

    occ_rate = round(occupied_rooms / total_rooms, 4) if total_rooms > 0 else 0.0

    # 2. Arrivals & departures today
    arrivals_today = db.scalar(
        select(func.count(Booking.id)).where(
            Booking.property_id == branch,
            Booking.check_in_date == today,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
        )
    ) or 0

    departures_today = db.scalar(
        select(func.count(Booking.id)).where(
            Booking.property_id == branch,
            Booking.check_out_date == today,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        )
    ) or 0

    in_house_guests = occupied_rooms

    # 3. Department list
    departments = db.scalars(
        select(Department).where(Department.property_id == branch).order_by(Department.name)
    ).all()

    # 4. Aggregated Tasks grouped by department
    task_stmt = select(
        Task.department_id,
        func.coalesce(
            func.sum(case((Task.status.in_([TaskStatus.OPEN, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS]), 1), else_=0)),
            0,
        ).label("open_tasks"),
        func.coalesce(
            func.sum(case((
                Task.status.in_([TaskStatus.OPEN, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS]) & (Task.due_at < now), 1
            ), else_=0)),
            0,
        ).label("overdue_tasks"),
        func.coalesce(
            func.sum(case((
                (Task.status == TaskStatus.DONE) & (Task.completed_at >= begin_dt) & (Task.completed_at <= finish_dt), 1
            ), else_=0)),
            0,
        ).label("completed_tasks"),
    ).where(
        Task.property_id == branch
    ).group_by(Task.department_id)

    task_map = {row.department_id: row for row in db.execute(task_stmt).all()}

    # 5. Aggregated Service Requests grouped by department
    req_open_statuses = [RequestStatus.RAISED, RequestStatus.ACCEPTED, RequestStatus.IN_PROGRESS]
    req_stmt = select(
        ServiceRequest.department_id,
        func.coalesce(
            func.sum(case((ServiceRequest.status.in_(req_open_statuses), 1), else_=0)),
            0,
        ).label("open_requests"),
        func.coalesce(
            func.sum(case((
                ServiceRequest.status.in_(req_open_statuses) & (ServiceRequest.due_at < now), 1
            ), else_=0)),
            0,
        ).label("overdue_requests"),
    ).where(
        ServiceRequest.property_id == branch
    ).group_by(ServiceRequest.department_id)

    req_map = {row.department_id: row for row in db.execute(req_stmt).all()}

    # 6. Aggregated Attendance today grouped by department
    att_stmt = select(
        Attendance.department_id,
        func.count(Attendance.id).label("attendance_today"),
    ).where(
        Attendance.property_id == branch,
        Attendance.work_date >= today_dt,
    ).group_by(Attendance.department_id)

    att_map = {row.department_id: row for row in db.execute(att_stmt).all()}

    dept_snapshots: list[DepartmentSnapshot] = []
    total_open_tasks = 0
    total_overdue_tasks = 0
    total_open_requests = 0
    total_overdue_requests = 0

    for d in departments:
        t_data = task_map.get(d.id)
        r_data = req_map.get(d.id)
        a_data = att_map.get(d.id)

        o_tasks = int(t_data.open_tasks) if t_data else 0
        od_tasks = int(t_data.overdue_tasks) if t_data else 0
        c_tasks = int(t_data.completed_tasks) if t_data else 0

        o_reqs = int(r_data.open_requests) if r_data else 0
        od_reqs = int(r_data.overdue_requests) if r_data else 0

        att_td = int(a_data.attendance_today) if a_data else 0

        total_open_tasks += o_tasks
        total_overdue_tasks += od_tasks
        total_open_requests += o_reqs
        total_overdue_requests += od_reqs

        dept_snapshots.append(DepartmentSnapshot(
            department_id=d.id,
            department_name=d.name,
            open_requests=o_reqs,
            overdue_requests=od_reqs,
            open_tasks=o_tasks,
            overdue_tasks=od_tasks,
            completed_tasks_in_period=c_tasks,
            attendance_today=att_td,
        ))

    exceptions: list[OverviewException] = []
    if total_overdue_tasks > 0:
        exceptions.append(OverviewException(
            kind="overdue_tasks",
            count=total_overdue_tasks,
            path="/admin/tasks",
        ))
    if total_overdue_requests > 0:
        exceptions.append(OverviewException(
            kind="overdue_requests",
            count=total_overdue_requests,
            path="/admin/requests",
        ))

    insights = FactualInsights(
        source="system_aggregate",
        state="live",
        generated_at=now,
        items=[
            f"Occupancy currently at {round(occ_rate * 100, 1)}% with {occupied_rooms} active in-house stays out of {total_rooms} rooms.",
            f"{arrivals_today} arrivals and {departures_today} departures scheduled for today.",
            f"{total_open_tasks} active tasks and {total_open_requests} guest service requests underway across all operational units.",
        ],
    )

    return {
        "branch_id": branch,
        "period_start": begin,
        "period_end": finish,
        "generated_at": now,
        "freshness": "live",
        "guests": {
            "in_house": in_house_guests,
            "expected_arrivals": arrivals_today,
            "expected_departures": departures_today,
        },
        "occupancy": {
            "rate": occ_rate,
            "occupied_rooms": occupied_rooms,
            "total_rooms": total_rooms,
        },
        "arrivals_today": arrivals_today,
        "departures_today": departures_today,
        "departments": [d.model_dump() for d in dept_snapshots],
        "exceptions": [e.model_dump() for e in exceptions],
        "insights": insights.model_dump(),
    }


def department_overview(
    db: Session,
    branch: UUID,
    department: Department,
    begin: date,
    finish: date,
) -> dict:
    """Generate department-scoped operational performance snapshot."""
    now = utcnow()
    today = now.date()
    today_dt = datetime.combine(today, time.min)
    begin_dt = datetime.combine(begin, time.min)
    finish_dt = datetime.combine(finish, time.max)

    # 1. Tasks
    t_stmt = select(
        func.coalesce(
            func.sum(case((Task.status.in_([TaskStatus.OPEN, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS]), 1), else_=0)),
            0,
        ).label("open_tasks"),
        func.coalesce(
            func.sum(case((
                Task.status.in_([TaskStatus.OPEN, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS]) & (Task.due_at < now), 1
            ), else_=0)),
            0,
        ).label("overdue_tasks"),
        func.coalesce(
            func.sum(case((
                (Task.status == TaskStatus.DONE) & (Task.completed_at >= begin_dt) & (Task.completed_at <= finish_dt), 1
            ), else_=0)),
            0,
        ).label("completed_tasks"),
    ).where(
        Task.property_id == branch,
        Task.department_id == department.id,
    )
    t_row = db.execute(t_stmt).one()

    # 2. Service Requests
    req_open_statuses = [RequestStatus.RAISED, RequestStatus.ACCEPTED, RequestStatus.IN_PROGRESS]
    r_stmt = select(
        func.coalesce(
            func.sum(case((ServiceRequest.status.in_(req_open_statuses), 1), else_=0)),
            0,
        ).label("open_requests"),
        func.coalesce(
            func.sum(case((
                ServiceRequest.status.in_(req_open_statuses) & (ServiceRequest.due_at < now), 1
            ), else_=0)),
            0,
        ).label("overdue_requests"),
    ).where(
        ServiceRequest.property_id == branch,
        ServiceRequest.department_id == department.id,
    )
    r_row = db.execute(r_stmt).one()

    # 3. Attendance
    att_today = db.scalar(
        select(func.count(Attendance.id)).where(
            Attendance.property_id == branch,
            Attendance.department_id == department.id,
            Attendance.work_date >= today_dt,
        )
    ) or 0

    snapshot = DepartmentSnapshot(
        department_id=department.id,
        department_name=department.name,
        open_requests=int(r_row.open_requests or 0),
        overdue_requests=int(r_row.overdue_requests or 0),
        open_tasks=int(t_row.open_tasks or 0),
        overdue_tasks=int(t_row.overdue_tasks or 0),
        completed_tasks_in_period=int(t_row.completed_tasks or 0),
        attendance_today=int(att_today),
    )

    return {
        "branch_id": branch,
        "period_start": begin,
        "period_end": finish,
        "generated_at": now,
        "department": snapshot.model_dump(),
    }
