"""Auto-roster generation, publishing and staffing-gap cards."""
from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from vesper_common.clients import action, identity, property_client, revenue, staff
from vesper_common.clock import local_today, utcnow
from vesper_common.errors import Conflict, Invalid, NotFound
from vesper_common.permissions import Perm

from .engines import roster as engine
from .engines.roster import Demand, Employee
from .models import LeaveRequest, LeaveStatus, Roster, RosterEntry, RosterStatus

log = logging.getLogger(__name__)

# What an unfilled shift costs: overtime to cover it, or service that slips. Used as the
# staffing-gap card's impact figure.
COST_PER_UNFILLED_SHIFT = Decimal("2800")
# Don't bother a manager about a single missing person on one quiet shift.
MIN_GAPS_FOR_CARD = 2


def generate_roster(
    db: Session,
    property_id: UUID,
    *,
    week_start: date | None = None,
    department_id: UUID | None = None,
    token: str | None = None,
) -> Roster:
    """Build next week's draft roster from the demand forecast and who is available."""
    start = week_start or (local_today() + timedelta(days=1))
    days = engine.week_dates(start)

    departments = property_client.get("/property/departments", property_id=property_id, token=token) or []
    if department_id:
        departments = [d for d in departments if d["id"] == str(department_id)]
    if not departments:
        raise Invalid("No departments configured to roster")

    shifts = staff.get("/attendance/shifts", property_id=property_id, token=token) or []
    shift_keys = [s["key"] for s in shifts]
    if not shift_keys:
        raise Invalid("No shifts configured — set those up before rostering")

    occupancy = property_client.get("/property/occupancy", property_id=property_id, token=token) or {}
    total_rooms = int(occupancy.get("total_rooms") or 0)
    forecast = revenue.get("/revenue/forecast", property_id=property_id, token=token, params={"days": 14}) or []
    predicted = {f["stay_date"]: f["predicted_occupancy"] for f in forecast}
    # No forecast yet (cold start): fall back to today's actual occupancy rather than
    # refusing to roster at all.
    fallback_occupancy = float(occupancy.get("occupancy_rate") or 0.7)

    demands: list[Demand] = []
    for department in departments:
        for day in days:
            rate = predicted.get(day.isoformat(), fallback_occupancy)
            demands.extend(
                engine.demand_for(
                    department_key=department["key"],
                    department_id=department["id"],
                    day=day,
                    occupied_rooms=rate * total_rooms,
                    shift_keys=shift_keys,
                )
            )

    employees = _employees(property_id, departments, days, shift_keys, db, token=token)
    result = engine.build(employees, demands)

    # Supersede any previous draft for the same week so the grid shows one roster.
    previous = db.scalars(
        select(Roster).where(
            Roster.property_id == property_id,
            Roster.week_start == start,
            Roster.status == RosterStatus.DRAFT,
        )
    ).all()
    for row in previous:
        row.status = RosterStatus.SUPERSEDED

    roster = Roster(
        property_id=property_id,
        department_id=department_id,
        week_start=start,
        method=result.method,
        objective=result.objective,
        gaps=[
            {
                "department_id": g.department_id,
                "date": g.day.isoformat(),
                "shift_key": g.shift_key,
                "needed": g.needed,
                "assigned": g.assigned,
                "short_by": g.short_by,
            }
            for g in result.gaps
        ],
    )
    db.add(roster)
    db.flush()

    for assignment in result.assignments:
        db.add(
            RosterEntry(
                roster_id=roster.id,
                property_id=property_id,
                user_id=UUID(assignment.employee_id),
                department_id=UUID(assignment.department_id),
                work_date=assignment.day,
                shift_key=assignment.shift_key,
            )
        )
    db.commit()
    db.refresh(roster)

    if len(result.gaps) >= MIN_GAPS_FOR_CARD:
        _raise_gap_card(property_id, roster, result.gaps, departments)
    return roster


def _employees(
    property_id: UUID,
    departments: list[dict],
    days: list[date],
    shift_keys: list[str],
    db: Session,
    *,
    token: str | None,
) -> list[Employee]:
    """Who can work, and what they are already carrying."""
    department_ids = {d["id"] for d in departments}
    users = identity.get("/admin/users", property_id=property_id, token=token) or []
    leave = _approved_leave(db, property_id, days[0], days[-1])

    employees: list[Employee] = []
    for user in users:
        if not user.get("is_active", True):
            continue
        if str(user.get("department_id")) not in department_ids:
            continue
        employees.append(
            Employee(
                id=str(user["id"]),
                name=user.get("full_name", ""),
                department_id=str(user["department_id"]),
                # Without per-person shift preferences in the demo data, everyone is
                # eligible for every shift their department runs.
                eligible_shifts=set(shift_keys),
                unavailable_dates=leave.get(str(user["id"]), set()),
            )
        )
    return employees


def _approved_leave(db: Session, property_id: UUID, start: date, end: date) -> dict[str, set[date]]:
    rows = db.scalars(
        select(LeaveRequest).where(
            LeaveRequest.property_id == property_id,
            LeaveRequest.status == LeaveStatus.APPROVED,
            LeaveRequest.from_date <= end,
            LeaveRequest.to_date >= start,
        )
    ).all()
    blocked: dict[str, set[date]] = {}
    for row in rows:
        dates = blocked.setdefault(str(row.user_id), set())
        day = max(row.from_date, start)
        while day <= min(row.to_date, end):
            dates.add(day)
            day += timedelta(days=1)
    return blocked


def _raise_gap_card(property_id: UUID, roster: Roster, gaps, departments: list[dict]) -> None:
    """Tell the queue we cannot cover the week as it stands."""
    names = {d["id"]: d["name"] for d in departments}
    total_short = sum(g.short_by for g in gaps)
    worst = max(gaps, key=lambda g: g.short_by)

    action.post(
        "/cards",
        property_id=property_id,
        json={
            "engine": "workforce",
            "kind": "staffing_gap",
            "title": f"{total_short} unfilled shift(s) in the week of {roster.week_start:%d %b}",
            "summary": (
                f"The auto-roster could not cover {len(gaps)} slot(s). The worst is "
                f"{names.get(worst.department_id, 'a department')} on {worst.day:%A %d %b} "
                f"({worst.shift_key}), short by {worst.short_by}."
            ),
            "required_permission": Perm.ROSTER_APPROVE.value,
            "drivers": [
                {
                    "label": f"{names.get(g.department_id, 'Department')} · {g.day:%a %d %b}",
                    "detail": f"{g.shift_key}: {g.assigned} of {g.needed} rostered",
                    "weight": round(min(1.0, g.short_by / max(g.needed, 1)), 3),
                }
                for g in sorted(gaps, key=lambda g: g.short_by, reverse=True)[:5]
            ],
            "confidence": 0.85,
            "impact_amount": float(COST_PER_UNFILLED_SHIFT * total_short),
            "urgency": "high" if (roster.week_start - local_today()).days <= 3 else "medium",
            "payload": {
                "roster_id": str(roster.id),
                "week_start": roster.week_start.isoformat(),
                "gaps": roster.gaps,
                "editable_fields": [],
                "task": {
                    "title": f"Cover {total_short} unfilled shift(s) for the week of {roster.week_start:%d %b}",
                    "description": "Arrange cover, overtime or agency staff for the gaps listed on the card.",
                    "department_id": worst.department_id,
                    "priority": "high",
                    "due_in_minutes": 60 * 24,
                },
            },
            "dedupe_key": f"staffing_gap:{roster.week_start.isoformat()}",
        },
    )


def get_roster(db: Session, property_id: UUID, roster_id: UUID) -> Roster:
    query = (
        select(Roster)
        .options(joinedload(Roster.entries))
        .where(Roster.id == roster_id, Roster.property_id == property_id)
    )
    roster = db.scalars(query).unique().first()
    if roster is None:
        raise NotFound("Roster not found")
    return roster


def list_rosters(db: Session, property_id: UUID, *, status: str | None = None) -> list[Roster]:
    query = select(Roster).where(Roster.property_id == property_id)
    if status:
        query = query.where(Roster.status == status)
    return list(db.scalars(query.order_by(Roster.week_start.desc())))


def current_roster(db: Session, property_id: UUID, week_start: date | None = None) -> Roster | None:
    """The published roster for a week, or the newest draft if none is published."""
    start = week_start or local_today()
    monday = start - timedelta(days=start.weekday())
    query = (
        select(Roster)
        .options(joinedload(Roster.entries))
        .where(
            Roster.property_id == property_id,
            Roster.week_start >= monday - timedelta(days=7),
            Roster.status.in_([RosterStatus.PUBLISHED, RosterStatus.DRAFT]),
        )
        .order_by(Roster.status, Roster.week_start.desc())
    )
    return db.scalars(query).unique().first()


def publish_roster(db: Session, property_id: UUID, roster_id: UUID, *, actor_id: UUID) -> Roster:
    roster = get_roster(db, property_id, roster_id)
    if roster.status == RosterStatus.PUBLISHED:
        raise Conflict("That roster is already published")

    # Only one published roster per week.
    others = db.scalars(
        select(Roster).where(
            Roster.property_id == property_id,
            Roster.week_start == roster.week_start,
            Roster.status == RosterStatus.PUBLISHED,
            Roster.id != roster.id,
        )
    ).all()
    for other in others:
        other.status = RosterStatus.SUPERSEDED

    roster.status = RosterStatus.PUBLISHED
    roster.published_by = actor_id
    roster.published_at = utcnow()
    db.commit()
    db.refresh(roster)
    return roster


def apply_assignments(db: Session, property_id: UUID, assignments: list[dict], *, source_card_id: UUID | None, is_revert: bool = False) -> dict:
    """Swap the entries of a roster wholesale, returning what was there before.

    This is the executor path for a roster-change card: the returned
    `previous_assignments` is exactly what undo replays.
    """
    if not assignments:
        return {"applied": 0, "previous_assignments": []}

    roster_id = assignments[0].get("roster_id")
    if not roster_id:
        raise Invalid("Roster assignments must name the roster they belong to")
    roster = get_roster(db, property_id, UUID(roster_id))

    previous = [
        {
            "roster_id": str(roster.id),
            "user_id": str(e.user_id),
            "department_id": str(e.department_id),
            "work_date": e.work_date.isoformat(),
            "shift_key": e.shift_key,
        }
        for e in roster.entries
    ]

    for entry in list(roster.entries):
        db.delete(entry)
    db.flush()

    for assignment in assignments:
        db.add(
            RosterEntry(
                roster_id=roster.id,
                property_id=property_id,
                user_id=UUID(assignment["user_id"]),
                department_id=UUID(assignment["department_id"]),
                work_date=date.fromisoformat(assignment["work_date"]),
                shift_key=assignment["shift_key"],
            )
        )
    if not is_revert:
        roster.notes = f"Adjusted by card {source_card_id}" if source_card_id else roster.notes
    db.commit()

    return {"applied": len(assignments), "previous_assignments": previous}


def staffing_chart(db: Session, property_id: UUID, roster_id: UUID) -> list[dict]:
    """Needed versus scheduled, per day per shift — the gap chart on the roster page."""
    roster = get_roster(db, property_id, roster_id)
    scheduled: dict[tuple[str, str, str], int] = {}
    for entry in roster.entries:
        key = (str(entry.department_id), entry.work_date.isoformat(), entry.shift_key)
        scheduled[key] = scheduled.get(key, 0) + 1

    rows: list[dict] = []
    seen = set()
    for gap in roster.gaps:
        key = (gap["department_id"], gap["date"], gap["shift_key"])
        seen.add(key)
        rows.append(
            {
                "department_id": gap["department_id"],
                "date": gap["date"],
                "shift_key": gap["shift_key"],
                "needed": gap["needed"],
                "scheduled": scheduled.get(key, 0),
                "short_by": gap["short_by"],
            }
        )
    for key, count in scheduled.items():
        if key in seen:
            continue
        rows.append(
            {
                "department_id": key[0],
                "date": key[1],
                "shift_key": key[2],
                "needed": count,
                "scheduled": count,
                "short_by": 0,
            }
        )
    return sorted(rows, key=lambda r: (r["date"], r["shift_key"]))


# --- leave ------------------------------------------------------------------------


def request_leave(db: Session, property_id: UUID, user_id: UUID, data) -> LeaveRequest:
    if data.to_date < data.from_date:
        raise Invalid("Leave cannot end before it starts")
    row = LeaveRequest(
        property_id=property_id,
        user_id=user_id,
        from_date=data.from_date,
        to_date=data.to_date,
        reason=data.reason,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def decide_leave(db: Session, property_id: UUID, leave_id: UUID, *, approve: bool, actor_id: UUID) -> LeaveRequest:
    query = select(LeaveRequest).where(
        LeaveRequest.id == leave_id, LeaveRequest.property_id == property_id
    )
    row = db.scalars(query).first()
    if row is None:
        raise NotFound("Leave request not found")
    if row.status != LeaveStatus.REQUESTED:
        raise Conflict(f"That request is already {row.status}")

    row.status = LeaveStatus.APPROVED if approve else LeaveStatus.REJECTED
    row.decided_by = actor_id
    row.decided_at = utcnow()
    db.commit()
    db.refresh(row)
    return row


def list_leave(db: Session, property_id: UUID, *, status: str | None = None, user_id: UUID | None = None) -> list[LeaveRequest]:
    query = select(LeaveRequest).where(LeaveRequest.property_id == property_id)
    if status:
        query = query.where(LeaveRequest.status == status)
    if user_id:
        query = query.where(LeaveRequest.user_id == user_id)
    return list(db.scalars(query.order_by(LeaveRequest.from_date.desc())))
