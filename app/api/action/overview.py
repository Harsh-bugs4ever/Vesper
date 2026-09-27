"""Action overview and executive dashboards."""
from datetime import date, datetime, time, timedelta
import time as time_module
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
from app.api.guest_intel.models import GuestStaffReview
from app.api.inventory.models import DepartmentBudget, InventoryRequest, StockItem
from app.api.inventory.procurement import budget_totals
from app.api.property.models import Department, Room
from app.api.revenue.models import DemandForecast
from app.api.staff.models import Attendance, Task, TaskStatus

_GM_CACHE: dict[tuple[UUID, date, date], tuple[float, dict]] = {}
_DEPT_CACHE: dict[tuple[UUID, UUID, date, date], tuple[float, dict]] = {}
_OVERVIEW_CACHE_TTL_SEC = 3.0


def invalidate_overview_cache() -> None:
    _GM_CACHE.clear()
    _DEPT_CACHE.clear()


def gm_overview(db: Session, branch: UUID, begin: date, finish: date) -> dict:
    """Generate high-performance holistic GM executive overview with micro-caching."""
    cache_key = (branch, begin, finish)
    now_ts = time_module.time()
    cached = _GM_CACHE.get(cache_key)
    if cached and (now_ts - cached[0]) < _OVERVIEW_CACHE_TTL_SEC:
        return cached[1]

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

    # 7. 14-day Forecast occupancy curve for workforce predictions
    next_14_forecasts = list(
        db.scalars(
            select(DemandForecast.predicted_occupancy)
            .where(
                DemandForecast.property_id == branch,
                DemandForecast.stay_date > today,
            )
            .order_by(DemandForecast.stay_date)
            .limit(14)
        )
    )
    if not next_14_forecasts:
        # Fallback occupancy curve based on current occupied rate
        base_rate = occ_rate or 0.65
        next_14_forecasts = [min(1.0, max(0.2, base_rate + (i % 3 - 1) * 0.05)) for i in range(14)]

    # 8. Department Budgets
    budgets_stmt = select(DepartmentBudget).where(
        DepartmentBudget.property_id == branch,
        DepartmentBudget.period_start <= today,
        DepartmentBudget.period_end >= today,
    )
    budget_map = {row.department_id: row for row in db.scalars(budgets_stmt).all()}

    # 9. Low stock items grouped by department
    low_stock_stmt = select(
        StockItem.department_id,
        func.count(StockItem.id).label("low_count"),
    ).where(
        StockItem.property_id == branch,
        StockItem.quantity <= StockItem.minimum_quantity,
    ).group_by(StockItem.department_id)
    low_stock_map = {row.department_id: int(row.low_count) for row in db.execute(low_stock_stmt).all()}

    # 10. Pending inventory requisitions
    req_inv_stmt = select(
        InventoryRequest.department_id,
        func.count(InventoryRequest.id).label("pending_count"),
    ).where(
        InventoryRequest.property_id == branch,
        InventoryRequest.status == "submitted",
    ).group_by(InventoryRequest.department_id)
    pending_req_map = {row.department_id: int(row.pending_count) for row in db.execute(req_inv_stmt).all()}

    # 11. Staff reviews / team rating
    rev_stmt = select(
        GuestStaffReview.department_id,
        func.avg(GuestStaffReview.rating).label("avg_score"),
    ).where(
        GuestStaffReview.property_id == branch,
        GuestStaffReview.department_id.is_not(None),
    ).group_by(GuestStaffReview.department_id)
    try:
        rev_map = {row.department_id: float(row.avg_score) for row in db.execute(rev_stmt).all() if row.avg_score is not None}
    except Exception:
        rev_map = {}

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

        # AI Workforce Predictor formula:
        # Base baseline workers + occupancy scaling
        dept_key = (d.key or "").lower()
        multiplier = 14 if "fnb" in dept_key else 16 if "house" in dept_key else 8 if "front" in dept_key else 4
        staff_curve = [max(2, int(round(occ * multiplier + (2 if i in [5, 6, 12, 13] else 0)))) for i, occ in enumerate(next_14_forecasts)]
        avg_predicted = int(round(sum(staff_curve) / len(staff_curve))) if staff_curve else att_td

        b_row = budget_map.get(d.id)
        totals = budget_totals(db, b_row) if b_row else None
        allocated_amt = float(totals["allocated"]) if totals else 0.0
        spent_amt = float(totals["spent"]) if totals else 0.0
        remaining_amt = float(totals["remaining"]) if totals else 0.0

        dept_snapshots.append(DepartmentSnapshot(
            department_id=d.id,
            department_name=d.name,
            open_requests=o_reqs,
            overdue_requests=od_reqs,
            open_tasks=o_tasks,
            overdue_tasks=od_tasks,
            completed_tasks_in_period=c_tasks,
            attendance_today=att_td,
            active_shift_name="Shift schedule unavailable",
            staff_needed_next_14d=staff_curve,
            avg_predicted_staff_daily=avg_predicted,
            low_stock_items=low_stock_map.get(d.id, 0),
            pending_requisitions=pending_req_map.get(d.id, 0),
            budget_allocated=allocated_amt,
            budget_spent=spent_amt,
            budget_remaining=remaining_amt,
            currency=b_row.currency if b_row else "INR",
            team_rating=round(rev_map.get(d.id, 0.0), 1),
            sla_on_time_pct=round(100 * (o_tasks + o_reqs - od_tasks - od_reqs) /
                                  (o_tasks + o_reqs)) if o_tasks + o_reqs else 0,
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
    _GM_CACHE[cache_key] = (now_ts, res)
    return res


def department_overview(
    db: Session,
    branch: UUID,
    department: Department,
    begin: date,
    finish: date,
) -> dict:
    """Generate department-scoped operational performance snapshot."""
    cache_key = (branch, department.id, begin, finish)
    now_ts = time_module.time()
    cached = _DEPT_CACHE.get(cache_key)
    if cached and (now_ts - cached[0]) < _OVERVIEW_CACHE_TTL_SEC:
        return cached[1]

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

    next_14_forecasts = list(
        db.scalars(
            select(DemandForecast.predicted_occupancy)
            .where(DemandForecast.property_id == branch, DemandForecast.stay_date > today)
            .order_by(DemandForecast.stay_date)
            .limit(14)
        )
    )
    if not next_14_forecasts:
        next_14_forecasts = [0.72] * 14

    dept_key = getattr(department, "key", "") or getattr(department, "name", "") or ""
    dept_key = str(dept_key).lower()
    multiplier = 14 if "fnb" in dept_key else 16 if "house" in dept_key else 8 if "front" in dept_key else 4
    staff_curve = [max(2, int(round(occ * multiplier + (2 if i in [5, 6, 12, 13] else 0)))) for i, occ in enumerate(next_14_forecasts)]
    avg_predicted = int(round(sum(staff_curve) / len(staff_curve))) if staff_curve else int(att_today)

    try:
        b_row = db.scalars(
            select(DepartmentBudget).where(
                DepartmentBudget.property_id == branch,
                DepartmentBudget.department_id == department.id,
                DepartmentBudget.period_start <= today,
                DepartmentBudget.period_end >= today,
            )
        ).first()
        totals = budget_totals(db, b_row) if b_row else None
        allocated_amt = float(totals["allocated"]) if totals else 0.0
    except Exception:
        b_row = None
        totals = None
        allocated_amt = 0.0
    spent_amt = float(totals["spent"]) if b_row and totals else 0.0
    remaining_amt = float(totals["remaining"]) if b_row and totals else 0.0

    try:
        low_stock_count = db.scalar(
            select(func.count(StockItem.id)).where(
                StockItem.property_id == branch,
                StockItem.department_id == department.id,
                StockItem.quantity <= StockItem.minimum_quantity,
            )
        ) or 0
    except Exception:
        low_stock_count = 0

    try:
        pending_req_count = db.scalar(
            select(func.count(InventoryRequest.id)).where(
                InventoryRequest.property_id == branch,
                InventoryRequest.department_id == department.id,
                InventoryRequest.status == "submitted",
            )
        ) or 0
    except Exception:
        pending_req_count = 0

    try:
        avg_score = db.scalar(
            select(func.avg(GuestStaffReview.rating)).where(
                GuestStaffReview.property_id == branch,
                GuestStaffReview.department_id == department.id,
            )
        )
    except Exception:
        avg_score = None

    o_tasks = int(t_row.open_tasks or 0)
    od_tasks = int(t_row.overdue_tasks or 0)
    o_reqs = int(r_row.open_requests or 0)
    od_reqs = int(r_row.overdue_requests or 0)

    snapshot = DepartmentSnapshot(
        department_id=department.id,
        department_name=department.name,
        open_requests=o_reqs,
        overdue_requests=od_reqs,
        open_tasks=o_tasks,
        overdue_tasks=od_tasks,
        completed_tasks_in_period=int(t_row.completed_tasks or 0),
        attendance_today=int(att_today),
        active_shift_name="Shift schedule unavailable",
        staff_needed_next_14d=staff_curve,
        avg_predicted_staff_daily=avg_predicted,
        low_stock_items=int(low_stock_count),
        pending_requisitions=int(pending_req_count),
        budget_allocated=allocated_amt,
        budget_spent=spent_amt,
        budget_remaining=remaining_amt,
        currency=b_row.currency if b_row else "INR",
        team_rating=round(float(avg_score), 1) if avg_score else 0.0,
        sla_on_time_pct=round(100 * (o_tasks + o_reqs - od_tasks - od_reqs) /
                              (o_tasks + o_reqs)) if o_tasks + o_reqs else 0,
    )

    res = {
        "branch_id": branch,
        "period_start": begin,
        "period_end": finish,
        "generated_at": now,
        "department": snapshot.model_dump(),
    }
    _DEPT_CACHE[cache_key] = (now_ts, res)
    return res
