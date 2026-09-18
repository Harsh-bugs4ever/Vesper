"""The roster solver's hard rules.

These must hold whichever solver ran. Nobody works two shifts in a day or seven days in
a week, whether CP-SAT proved it optimal or the greedy path merely filled the grid.
"""
from __future__ import annotations

import sys
from collections import Counter
from datetime import date
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(SERVICE_ROOT.parents[1] / "packages" / "py-common"))

from app.engines import roster  # noqa: E402
from app.engines.roster import Demand, Employee  # noqa: E402

MONDAY = date(2026, 9, 21)
SHIFTS = ["morning", "evening", "night"]
DEPT = "dept-housekeeping"


def team(n: int, *, department: str = DEPT, shifts=None) -> list[Employee]:
    # Ids are namespaced by department so two teams can coexist in one test.
    return [
        Employee(
            id=f"{department}-emp-{i:03}",
            name=f"Employee {i:03}",
            department_id=department,
            eligible_shifts=set(shifts or SHIFTS),
        )
        for i in range(n)
    ]


def week_demand(headcount: int = 3, *, days: int = 7, shifts=None) -> list[Demand]:
    return [
        Demand(department_id=DEPT, day=day, shift_key=shift, headcount=headcount)
        for day in roster.week_dates(MONDAY, days)
        for shift in (shifts or SHIFTS)
    ]


def test_a_well_staffed_week_has_no_gaps():
    result = roster.build(team(60), week_demand())
    assert result.gaps == []
    assert result.method in {"cp_sat", "greedy"}


def test_nobody_works_two_shifts_in_one_day():
    result = roster.build(team(60), week_demand())
    per_person_per_day = Counter((a.employee_id, a.day) for a in result.assignments)
    assert max(per_person_per_day.values()) <= roster.MAX_SHIFTS_PER_DAY


def test_nobody_works_more_than_six_days_a_week():
    result = roster.build(team(25), week_demand())
    per_person = Counter(a.employee_id for a in result.assignments)
    assert max(per_person.values(), default=0) <= roster.MAX_SHIFTS_PER_WEEK


def test_leave_is_never_rostered_over():
    """Approved leave is a hard constraint, not a preference."""
    staff = team(40)
    blocked = roster.week_dates(MONDAY, 7)[:3]
    staff[0].unavailable_dates = set(blocked)

    result = roster.build(staff, week_demand())
    their_days = {a.day for a in result.assignments if a.employee_id == staff[0].id}
    assert their_days.isdisjoint(blocked)


def test_shift_eligibility_is_respected():
    staff = team(40)
    staff[0].eligible_shifts = {"morning"}
    result = roster.build(staff, week_demand())
    their_shifts = {a.shift_key for a in result.assignments if a.employee_id == staff[0].id}
    assert their_shifts <= {"morning"}


def test_nobody_is_rostered_into_another_department():
    mixed = team(30) + team(30, department="dept-fnb")
    assert len({e.id for e in mixed}) == 60, "the fixture must not reuse ids"
    result = roster.build(mixed, week_demand())
    by_id = {e.id: e for e in mixed}
    assert all(by_id[a.employee_id].department_id == a.department_id for a in result.assignments)


def test_short_staffing_reports_gaps_instead_of_failing():
    """A roster one short on Sunday is far more useful than no roster at all."""
    result = roster.build(team(4), week_demand(headcount=5))
    assert result.gaps, "an impossible week must report its gaps"
    assert result.assignments, "and still fill what it can"
    for gap in result.gaps:
        assert gap.short_by > 0
        assert gap.assigned < gap.needed


def test_no_slot_is_overfilled():
    result = roster.build(team(80), week_demand(headcount=2))
    per_slot = Counter((a.day, a.shift_key) for a in result.assignments)
    assert max(per_slot.values()) <= 2


def test_work_is_shared_out_rather_than_piled_on_one_person():
    result = roster.build(team(30), week_demand(headcount=2))
    per_person = Counter(a.employee_id for a in result.assignments)
    if per_person:
        # Nobody carries the week while colleagues sit idle.
        assert max(per_person.values()) - min(per_person.values(), default=0) <= 3


def test_no_employees_means_every_slot_is_a_gap():
    demands = week_demand()
    result = roster.build([], demands)
    assert result.assignments == []
    assert len(result.gaps) == len(demands)


def test_result_names_the_solver_that_ran():
    """The UI says whether this was optimised or merely filled."""
    result = roster.build(team(20), week_demand())
    assert result.method in {"cp_sat", "greedy", "no_input"}
    if result.method == "cp_sat":
        assert result.objective in {"optimal", "feasible"}


def test_deterministic_for_the_same_input():
    """Managers compare this week's roster to last week's; churn would be noise."""
    first = roster.build(team(30), week_demand())
    second = roster.build(team(30), week_demand())
    assert {(a.employee_id, a.day, a.shift_key) for a in first.assignments} == {
        (a.employee_id, a.day, a.shift_key) for a in second.assignments
    }


# --- demand modelling -------------------------------------------------------------


def test_housekeeping_scales_with_occupied_rooms():
    quiet = roster.demand_for(
        department_key="housekeeping", department_id=DEPT, day=MONDAY,
        occupied_rooms=50, shift_keys=SHIFTS,
    )
    busy = roster.demand_for(
        department_key="housekeeping", department_id=DEPT, day=MONDAY,
        occupied_rooms=340, shift_keys=SHIFTS,
    )
    assert sum(d.headcount for d in busy) > sum(d.headcount for d in quiet)


def test_security_does_not_scale_with_occupancy():
    """A gate needs the same cover whether the hotel is full or empty."""
    quiet = roster.demand_for(
        department_key="security", department_id=DEPT, day=MONDAY,
        occupied_rooms=20, shift_keys=SHIFTS,
    )
    busy = roster.demand_for(
        department_key="security", department_id=DEPT, day=MONDAY,
        occupied_rooms=350, shift_keys=SHIFTS,
    )
    assert sum(d.headcount for d in quiet) == sum(d.headcount for d in busy)


def test_housekeeping_is_a_morning_job_and_fnb_an_evening_one():
    def peak(department: str) -> str:
        demands = roster.demand_for(
            department_key=department, department_id=DEPT, day=MONDAY,
            occupied_rooms=300, shift_keys=SHIFTS,
        )
        return max(demands, key=lambda d: d.headcount).shift_key

    assert peak("housekeeping") == "morning"
    assert peak("fnb") == "evening"


def test_a_staffed_shift_always_gets_at_least_one_person():
    for department in roster.STAFFING_MODEL:
        demands = roster.demand_for(
            department_key=department, department_id=DEPT, day=MONDAY,
            occupied_rooms=5, shift_keys=SHIFTS,
        )
        assert all(d.headcount >= 1 for d in demands)


def test_an_unknown_department_asks_for_nobody():
    assert roster.demand_for(
        department_key="helipad", department_id=DEPT, day=MONDAY,
        occupied_rooms=300, shift_keys=SHIFTS,
    ) == []
