"""Role boundaries and record-derived overview contracts."""
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.api.action import overview
from app.api.property.router import spatial_view
from app.api.staff import metrics
from vesper_common.errors import Forbidden, NotFound
from vesper_common.permissions import Perm
from vesper_common.security import Principal, requires_gm
from vesper_common.security import current_user
from vesper_common.db import get_session


def principal(role: str, branch, *, department=None, user=None):
    return Principal(id=str(user or uuid4()), property_id=str(branch), role=role,
        permissions={str(Perm.LEARNING_READ), str(Perm.STAFF_REVIEW_READ)},
        property_ids={str(branch)},
        department_ids={str(department)} if department else set())


@pytest.mark.parametrize("role", ["manager", "staff"])
def test_specialist_permission_does_not_override_role(role):
    actor = principal(role, uuid4(), department=uuid4())
    with pytest.raises(HTTPException) as error:
        requires_gm(Perm.LEARNING_READ)(actor)
    assert error.value.status_code == 403


def test_gm_specialist_access_and_branch_scope():
    branch = uuid4()
    actor = principal("gm", branch)
    assert requires_gm(Perm.LEARNING_READ)(actor) is actor
    with pytest.raises(HTTPException):
        actor.require_property(uuid4())


def test_employee_filter_rejects_outside_department():
    branch, department, employee = uuid4(), uuid4(), uuid4()
    actor = principal("manager", branch, department=department)
    db = MagicMock()
    db.scalar.side_effect = [department, None]
    with pytest.raises(NotFound):
        metrics.scope(db, actor, branch_id=None, department_id=department,
                      employee_id=employee)
    with pytest.raises(HTTPException):
        metrics.scope(db, actor, branch_id=None, department_id=uuid4())


def test_staff_cannot_select_another_employee():
    actor = principal("staff", uuid4(), department=uuid4())
    with pytest.raises(Forbidden):
        metrics.scope(MagicMock(), actor, branch_id=None, department_id=None,
                      employee_id=uuid4())


def test_employee_totals_match_source_records():
    branch, employee, department = uuid4(), uuid4(), uuid4()
    work_day = datetime(2026, 9, 26)
    attendance = [
        SimpleNamespace(work_date=work_day, is_late=False, worked_minutes=420),
        SimpleNamespace(work_date=work_day, is_late=True, worked_minutes=120),
    ]
    assigned = [SimpleNamespace(id=uuid4()) for _ in range(3)]
    completed = [SimpleNamespace(id=uuid4()) for _ in range(2)]
    reviews = [SimpleNamespace(guest_id=uuid4(), rating=rating)
               for rating in (5, 4, 4, 3)]
    db = MagicMock()
    db.scalars.side_effect = [attendance, assigned, completed, reviews]
    result = metrics.employee_metrics(db, branch, employee, department,
                                      date(2026, 9, 1), date(2026, 9, 30))
    assert result["attendance_days"] == 1
    assert result["late_shifts"] == 1
    assert result["worked_minutes"] == 540
    assert result["assigned_tasks"] == 3
    assert result["completed_tasks"] == 2
    assert result["rating_mean"] == 4.0
    assert result["data_state"] == "sufficient"


def test_thin_review_data_has_no_rating_score():
    db = MagicMock()
    db.scalars.side_effect = [[], [], [], [SimpleNamespace(guest_id=uuid4(), rating=5)]]
    result = metrics.employee_metrics(db, uuid4(), uuid4(), None,
                                      date(2026, 9, 1), date(2026, 9, 30))
    assert result["guest_reviews"] == 1
    assert result["rating_mean"] is None
    assert result["data_state"] == "insufficient_data"


def test_gm_overview_totals_match_record_counts():
    db = MagicMock()
    db.scalar.side_effect = [10, 4, 7, 5, 2, 1, 1]
    db.scalars.return_value = []
    result = overview.gm_overview(db, uuid4(), date(2026, 9, 1), date(2026, 9, 30))
    assert result["occupancy"] == {"total_rooms": 10, "occupied_rooms": 4, "rate": 0.4}
    assert result["guests"] == {"registered": 7, "in_house": 5}
    assert (result["arrivals_today"], result["departures_today"]) == (2, 1)
    assert result["exceptions"] == [{"kind": "out_of_order_rooms", "count": 1,
                                     "path": "/rooms/board"}]
    assert result["insights"]["source"] == "factual"


def test_department_overview_contains_only_its_aggregates():
    db = MagicMock()
    db.scalar.side_effect = [3, 1, 4, 2, 6, 5]
    department = SimpleNamespace(id=uuid4(), name="Housekeeping")
    result = overview.department_overview(db, uuid4(), department,
        date(2026, 9, 1), date(2026, 9, 30))
    assert result["department"]["open_requests"] == 3
    assert result["department"]["overdue_tasks"] == 2
    assert result["department"]["completed_tasks_in_period"] == 6
    assert "guests" not in result


def test_spatial_view_rejects_staff_and_omits_guest_details():
    branch = uuid4()
    with pytest.raises(Forbidden):
        spatial_view(branch_id=None, principal=principal("staff", branch), db=MagicMock())
    room = SimpleNamespace(id=uuid4(), number="201", floor=2,
        category=SimpleNamespace(name="Suite"), status="dirty",
        notes="Private guest note", qr_secret="secret")
    db = MagicMock()
    db.get.return_value = SimpleNamespace(id=branch)
    db.scalars.side_effect = [[room], [room.id]]
    result = spatial_view(branch_id=None, principal=principal("manager", branch), db=db)
    assert result.rooms[0].occupied is True
    assert "notes" not in result.model_dump_json()
    assert "secret" not in result.model_dump_json()


@pytest.mark.parametrize("path", [
    "/dashboard", "/dashboard/overview", "/learning", "/learning/readiness",
    "/revenue/forecast", "/revenue/rate-card", "/revenue/competitors",
    "/guest-intel/at-risk", "/guest-intel/concierge/models",
])
def test_manager_cannot_open_specialist_api_even_with_old_grants(path):
    branch, department = uuid4(), uuid4()
    actor = principal("manager", branch, department=department)
    actor.permissions.update({str(Perm.DASHBOARD_READ), str(Perm.FORECAST_READ),
                              str(Perm.SETTINGS_WRITE), str(Perm.CARDS_READ)})
    app.dependency_overrides[current_user] = lambda: actor
    app.dependency_overrides[get_session] = lambda: MagicMock()
    try:
        response = TestClient(app).get(path)
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_direct_filtered_apis_reject_other_departments():
    branch, department = uuid4(), uuid4()
    actor = principal("manager", branch, department=department)
    actor.permissions.add(str(Perm.ATTENDANCE_READ_TEAM))
    actor.permissions.add(str(Perm.ROSTER_APPROVE))
    outside = uuid4()
    app.dependency_overrides[current_user] = lambda: actor
    app.dependency_overrides[get_session] = lambda: MagicMock()
    try:
        client = TestClient(app)
        for path in ("/performance/employees", "/workforce/employees",
                     "/performance/summary",
                     "/attendance/records", "/dashboard/department"):
            response = client.get(path, params={"department_id": str(outside)})
            assert response.status_code == 403, path
    finally:
        app.dependency_overrides.clear()


def test_gm_and_manager_overview_apis_return_different_scopes(monkeypatch):
    branch, department = uuid4(), uuid4()
    db = MagicMock()
    db.get.return_value = SimpleNamespace(id=department, property_id=branch,
                                          name="Housekeeping")
    db.scalar.return_value = department
    stamp = datetime.now(timezone.utc)
    department_data = {"department_id": department, "department_name": "Housekeeping",
        "open_requests": 1, "overdue_requests": 0, "open_tasks": 2,
        "overdue_tasks": 0, "completed_tasks_in_period": 3, "attendance_today": 2}
    monkeypatch.setattr(overview, "gm_overview", lambda *_: {
        "branch_id": branch, "period_start": date(2026, 9, 1),
        "period_end": date(2026, 9, 26), "generated_at": stamp,
        "freshness": "fresh", "guests": {"registered": 8, "in_house": 4},
        "occupancy": {"total_rooms": 10, "occupied_rooms": 4, "rate": 0.4},
        "arrivals_today": 2, "departures_today": 1,
        "departments": [department_data], "exceptions": [],
        "insights": {"source": "factual", "state": "fresh",
                     "generated_at": stamp, "items": []}})
    monkeypatch.setattr(overview, "department_overview", lambda *_: {
        "branch_id": branch, "period_start": date(2026, 9, 1),
        "period_end": date(2026, 9, 26), "generated_at": stamp,
        "department": department_data})
    app.dependency_overrides[get_session] = lambda: db
    try:
        gm = principal("gm", branch)
        gm.permissions.add(str(Perm.DASHBOARD_READ))
        app.dependency_overrides[current_user] = lambda: gm
        result = TestClient(app).get("/dashboard/overview")
        assert result.status_code == 200
        assert result.json()["guests"]["registered"] == 8

        manager = principal("manager", branch, department=department)
        app.dependency_overrides[current_user] = lambda: manager
        result = TestClient(app).get("/dashboard/department")
        assert result.status_code == 200
        assert result.json()["department"]["open_tasks"] == 2
        assert "guests" not in result.json()
    finally:
        app.dependency_overrides.clear()


def test_staff_personal_performance_api(monkeypatch):
    branch, staff_id = uuid4(), uuid4()
    actor = principal("staff", branch, user=staff_id)
    actor.permissions.add(str(Perm.STAFF_REVIEW_READ_OWN))
    monkeypatch.setattr(metrics, "employee_metrics", lambda *_: {
        "employee_id": staff_id, "branch_id": branch, "department_id": None,
        "period_start": date(2026, 9, 1), "period_end": date(2026, 9, 26),
        "attendance_days": 2, "late_shifts": 0, "worked_minutes": 960,
        "assigned_tasks": 3, "completed_tasks": 2, "guest_reviews": 1,
        "distinct_guest_reviews": 1, "rating_mean": None,
        "minimum_guest_reviews_for_rating": 4,
        "data_state": "insufficient_data", "generated_at": datetime.now(timezone.utc),
    })
    app.dependency_overrides[current_user] = lambda: actor
    app.dependency_overrides[get_session] = lambda: MagicMock()
    try:
        result = TestClient(app).get("/performance/me")
        assert result.status_code == 200
        assert result.json()["employee_id"] == str(staff_id)
        assert result.json()["rating_mean"] is None
    finally:
        app.dependency_overrides.clear()
