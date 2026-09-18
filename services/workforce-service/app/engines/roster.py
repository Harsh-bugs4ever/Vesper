"""Roster building.

The real problem: given how full the hotel will be, how many people each department
needs per shift, who is available, and the rules (one shift a day, rest between shifts,
weekly hours cap, leave), produce next week's roster.

That is a constraint satisfaction problem, so OR-Tools CP-SAT solves it when available.
Without it, a greedy fallback assigns by fairness — fewest hours first — which produces a
workable roster and never claims to be optimal. Both paths report which ran, because a
manager arguing with a roster deserves to know whether it was optimised or merely filled.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta

log = logging.getLogger(__name__)

# Hard rules. CP-SAT enforces them as constraints; the greedy path enforces them as
# checks before each assignment.
MAX_SHIFTS_PER_DAY = 1
MAX_SHIFTS_PER_WEEK = 6
MAX_CONSECUTIVE_DAYS = 6


@dataclass(slots=True)
class Employee:
    id: str
    name: str
    department_id: str
    # Shift keys this person can actually work.
    eligible_shifts: set[str] = field(default_factory=set)
    unavailable_dates: set[date] = field(default_factory=set)
    # Hours already worked this week, so a mid-week reroster stays fair.
    hours_this_week: float = 0.0


@dataclass(slots=True)
class Demand:
    """How many people one department needs, on one date, for one shift."""

    department_id: str
    day: date
    shift_key: str
    headcount: int


@dataclass(slots=True)
class Assignment:
    employee_id: str
    department_id: str
    day: date
    shift_key: str


@dataclass(slots=True)
class Gap:
    department_id: str
    day: date
    shift_key: str
    needed: int
    assigned: int

    @property
    def short_by(self) -> int:
        return max(0, self.needed - self.assigned)


@dataclass(slots=True)
class RosterResult:
    assignments: list[Assignment]
    gaps: list[Gap]
    method: str
    objective: str | None = None


def build(employees: Sequence[Employee], demands: Sequence[Demand]) -> RosterResult:
    if not employees or not demands:
        return RosterResult(assignments=[], gaps=[_gap(d, 0) for d in demands], method="no_input")

    result = _cp_sat(employees, demands)
    if result is not None:
        return result
    return _greedy(employees, demands)


def _cp_sat(employees: Sequence[Employee], demands: Sequence[Demand]) -> RosterResult | None:
    try:
        from ortools.sat.python import cp_model
    except ImportError:
        return None

    try:
        model = cp_model.CpModel()
        # x[(employee, demand)] = 1 when that person works that slot.
        x: dict[tuple[int, int], object] = {}
        for e_index, employee in enumerate(employees):
            for d_index, demand in enumerate(demands):
                if not _can_work(employee, demand):
                    continue
                x[(e_index, d_index)] = model.NewBoolVar(f"x_{e_index}_{d_index}")

        # Understaffing is allowed but penalised — a roster that is one short on Sunday
        # is far more useful than no roster at all.
        shortfalls = []
        for d_index, demand in enumerate(demands):
            candidates = [x[(e, d_index)] for e in range(len(employees)) if (e, d_index) in x]
            shortfall = model.NewIntVar(0, demand.headcount, f"short_{d_index}")
            model.Add(sum(candidates) + shortfall >= demand.headcount)
            model.Add(sum(candidates) <= demand.headcount)
            shortfalls.append(shortfall)

        by_employee_day: dict[tuple[int, date], list] = defaultdict(list)
        by_employee: dict[int, list] = defaultdict(list)
        for (e_index, d_index), var in x.items():
            by_employee_day[(e_index, demands[d_index].day)].append(var)
            by_employee[e_index].append(var)

        for variables in by_employee_day.values():
            model.Add(sum(variables) <= MAX_SHIFTS_PER_DAY)
        for variables in by_employee.values():
            model.Add(sum(variables) <= MAX_SHIFTS_PER_WEEK)

        # Fairness: minimise the busiest person's load alongside the shortfall, so the
        # solver spreads work instead of hammering whoever is most eligible.
        busiest = model.NewIntVar(0, MAX_SHIFTS_PER_WEEK, "busiest")
        for variables in by_employee.values():
            model.Add(busiest >= sum(variables))

        model.Minimize(sum(shortfalls) * 100 + busiest)

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 10.0
        solver.parameters.num_search_workers = 4
        status = solver.Solve(model)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            log.warning("CP-SAT found no feasible roster; falling back to greedy")
            return None

        assignments: list[Assignment] = []
        filled: dict[int, int] = defaultdict(int)
        for (e_index, d_index), var in x.items():
            if solver.Value(var):
                demand = demands[d_index]
                assignments.append(
                    Assignment(
                        employee_id=employees[e_index].id,
                        department_id=demand.department_id,
                        day=demand.day,
                        shift_key=demand.shift_key,
                    )
                )
                filled[d_index] += 1

        gaps = [_gap(d, filled[i]) for i, d in enumerate(demands) if filled[i] < d.headcount]
        return RosterResult(
            assignments=assignments,
            gaps=gaps,
            method="cp_sat",
            objective="optimal" if status == cp_model.OPTIMAL else "feasible",
        )
    except Exception:
        log.exception("CP-SAT solve failed; falling back to greedy")
        return None


def _greedy(employees: Sequence[Employee], demands: Sequence[Demand]) -> RosterResult:
    """Fill the tightest slots first, always with whoever has worked least.

    Not optimal, and does not pretend to be. It respects every hard rule, and it is
    deterministic, which matters more than elegance when a manager is comparing this
    week's roster to last week's.
    """
    load: dict[str, float] = {e.id: e.hours_this_week for e in employees}
    worked_days: dict[str, set[date]] = defaultdict(set)
    assignments: list[Assignment] = []
    gaps: list[Gap] = []

    # Hardest slots first: the ones with fewest eligible people.
    def scarcity(demand: Demand) -> int:
        return sum(1 for e in employees if _can_work(e, demand))

    for demand in sorted(demands, key=lambda d: (scarcity(d), d.day, d.shift_key)):
        candidates = [
            e
            for e in employees
            if _can_work(e, demand)
            and demand.day not in worked_days[e.id]
            and len(worked_days[e.id]) < MAX_SHIFTS_PER_WEEK
        ]
        candidates.sort(key=lambda e: (load[e.id], e.name))

        chosen = candidates[: demand.headcount]
        for employee in chosen:
            assignments.append(
                Assignment(
                    employee_id=employee.id,
                    department_id=demand.department_id,
                    day=demand.day,
                    shift_key=demand.shift_key,
                )
            )
            load[employee.id] += 8
            worked_days[employee.id].add(demand.day)

        if len(chosen) < demand.headcount:
            gaps.append(_gap(demand, len(chosen)))

    return RosterResult(assignments=assignments, gaps=gaps, method="greedy")


def _can_work(employee: Employee, demand: Demand) -> bool:
    return (
        employee.department_id == demand.department_id
        and demand.shift_key in employee.eligible_shifts
        and demand.day not in employee.unavailable_dates
    )


def _gap(demand: Demand, assigned: int) -> Gap:
    return Gap(
        department_id=demand.department_id,
        day=demand.day,
        shift_key=demand.shift_key,
        needed=demand.headcount,
        assigned=assigned,
    )


# --- demand modelling -------------------------------------------------------------

# People needed per shift, per department, at full occupancy. Housekeeping scales almost
# linearly with occupied rooms; the front desk barely moves; security does not move at
# all. Demo-grade ratios a GM can tune in settings.
STAFFING_MODEL: dict[str, dict] = {
    "housekeeping": {"per_occupied_room": 0.055, "minimum": 4, "scales": True},
    "fnb": {"per_occupied_room": 0.040, "minimum": 6, "scales": True},
    "front_office": {"per_occupied_room": 0.008, "minimum": 3, "scales": True},
    "maintenance": {"per_occupied_room": 0.004, "minimum": 2, "scales": False},
    "store": {"per_occupied_room": 0.002, "minimum": 1, "scales": False},
    "security": {"per_occupied_room": 0.0, "minimum": 4, "scales": False},
}

# How the day's work splits across shifts. Housekeeping is a morning job; F&B peaks at
# dinner. Getting this wrong is what produces a roster that looks fine in total and
# leaves the restaurant short at 9pm.
SHIFT_WEIGHTS: dict[str, dict[str, float]] = {
    "housekeeping": {"morning": 0.6, "evening": 0.3, "night": 0.1},
    "fnb": {"morning": 0.3, "evening": 0.55, "night": 0.15},
    "front_office": {"morning": 0.4, "evening": 0.4, "night": 0.2},
    "maintenance": {"morning": 0.5, "evening": 0.3, "night": 0.2},
    "store": {"morning": 0.7, "evening": 0.3, "night": 0.0},
    "security": {"morning": 0.33, "evening": 0.33, "night": 0.34},
}


def demand_for(
    *,
    department_key: str,
    department_id: str,
    day: date,
    occupied_rooms: float,
    shift_keys: Sequence[str],
) -> list[Demand]:
    """Turn a forecast into headcount per shift."""
    model = STAFFING_MODEL.get(department_key)
    if model is None:
        return []

    if model["scales"]:
        total = max(model["minimum"], round(occupied_rooms * model["per_occupied_room"]))
    else:
        total = model["minimum"]

    weights = SHIFT_WEIGHTS.get(department_key, {})
    demands: list[Demand] = []
    for shift_key in shift_keys:
        weight = weights.get(shift_key, 0.0)
        if weight <= 0:
            continue
        # Always at least one person on any shift the department runs at all.
        headcount = max(1, round(total * weight))
        demands.append(
            Demand(
                department_id=department_id, day=day, shift_key=shift_key, headcount=headcount
            )
        )
    return demands


def week_dates(start: date, days: int = 7) -> list[date]:
    return [start + timedelta(days=i) for i in range(days)]
