from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.frontdesk import router as frontdesk_router
from app.api.frontdesk import service as frontdesk
from app.api.frontdesk.models import Booking, BookingStatus
from app.api.maintenance import service as maintenance
from app.api.maintenance.models import WorkOrder, WorkOrderStatus
from app.api.property.models import Department, Room, RoomStatus
from app.api.property import service as property_service
from app.api.staff import reporting
from app.api.staff import router as staff_router
from app.api.staff.models import Task, TaskStatus
from app.api.staff.schemas import ReportCreate, TaskStatusUpdate
from app.api.guest.models import IssueReport, IssueStatus
from importlib import import_module

staff_reviews_router = import_module("app.api.guest_intel.staff_reviews_router")
from app.api.identity.models import User
from vesper_common.errors import Conflict, Forbidden, NotFound
from vesper_common.permissions import Perm, Role
from vesper_common.security import Principal


class Result:
    def __init__(self, value):
        self.value = value

    def first(self):
        return self.value

    def all(self):
        return self.value


class Database:
    def __init__(self, rows=(), objects=None):
        self.rows = iter(rows)
        self.objects = objects or {}
        self.added = []

    def scalars(self, query):
        return Result(next(self.rows))

    def get(self, cls, key):
        return self.objects.get((cls, key))

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        for obj in self.added:
            if obj.id is None:
                obj.id = uuid4()

    def commit(self):
        self.flush()

    def refresh(self, obj):
        pass


def principal(property_id, department_id, role=Role.STAFF, user_id=None, permissions=()):
    return Principal(
        id=str(user_id or uuid4()), property_id=str(property_id), role=role,
        property_ids={str(property_id)}, department_ids={str(department_id)},
        permissions=set(permissions),
    )


def test_front_desk_department_and_property_scope():
    property_id, front_office, housekeeping = uuid4(), uuid4(), uuid4()
    front = principal(property_id, front_office, permissions={Perm.BOOKINGS_READ})
    outsider = principal(property_id, housekeeping, permissions={Perm.BOOKINGS_READ})
    db = SimpleNamespace(scalar=lambda query: front_office)
    frontdesk_router._front_office(front, db)
    with pytest.raises(HTTPException) as denied:
        frontdesk_router._front_office(outsider, db)
    assert denied.value.status_code == 403

    # Detail lookup always includes the branch in its database predicate.
    record = Database(rows=[None])
    with pytest.raises(NotFound):
        frontdesk.get_booking(record, property_id, uuid4())


def test_today_reuses_booking_and_stay_sources(monkeypatch):
    property_id, today = uuid4(), date(2026, 9, 26)
    arrival = SimpleNamespace(id=uuid4())
    departure = SimpleNamespace(booking=SimpleNamespace(check_out_date=today))
    stays = [departure, SimpleNamespace(booking=SimpleNamespace(
        check_out_date=today + timedelta(days=1)))]
    monkeypatch.setattr(frontdesk, "list_bookings", lambda *a, **k: [arrival])
    monkeypatch.setattr(frontdesk, "list_stays", lambda *a, **k: stays)
    board = frontdesk.arrivals_and_departures(Database(), property_id, today)
    assert board["arrivals"] == [arrival]
    assert board["departures"] == [departure]
    assert board["in_house"] == stays
    assert board["in_house_count"] == 2


def test_room_allocation_checks_category_and_atomic_room_state(monkeypatch):
    property_id, category_id, room_id = uuid4(), uuid4(), uuid4()
    today = date(2026, 9, 26)
    booking = Booking(
        id=uuid4(), property_id=property_id, guest_id=uuid4(),
        room_category_id=category_id, reference="VS123456",
        check_in_date=today, check_out_date=today + timedelta(days=2),
        rate=Decimal("100"), total_amount=Decimal("200"),
        status=BookingStatus.CONFIRMED,
    )
    room = Room(id=room_id, property_id=property_id, category_id=category_id,
                number="204", status=RoomStatus.READY, qr_secret="old")
    monkeypatch.setattr(frontdesk, "local_today", lambda: today)
    monkeypatch.setattr(frontdesk.bus, "publish", lambda *a, **k: None)
    db = Database(rows=[booking, room, None])
    stay = frontdesk.check_in(db, property_id, booking.id, room_id, actor_id=str(uuid4()))
    assert stay.room_id == room_id
    assert booking.status == BookingStatus.CHECKED_IN
    assert room.status == RoomStatus.OCCUPIED

    other_booking = Booking(
        id=uuid4(), property_id=property_id, guest_id=uuid4(),
        room_category_id=category_id, reference="VS654321",
        check_in_date=today, check_out_date=today + timedelta(days=1),
        rate=Decimal("100"), total_amount=Decimal("100"),
        status=BookingStatus.CONFIRMED,
    )
    with pytest.raises(Conflict):
        frontdesk.check_in(Database(rows=[other_booking, room]), property_id,
                           other_booking.id, room_id, actor_id=str(uuid4()))


def test_housekeeping_cannot_ready_an_occupied_room():
    property_id, room_id = uuid4(), uuid4()
    room = Room(id=room_id, property_id=property_id, category_id=uuid4(),
                number="204", status=RoomStatus.DIRTY, qr_secret="x")
    with pytest.raises(Conflict):
        property_service.set_room_status(Database(rows=[room, uuid4()]),
                                         property_id, room_id, RoomStatus.READY)


def test_task_completion_requires_assignee_and_department(monkeypatch):
    property_id, department_id, other_department = uuid4(), uuid4(), uuid4()
    actor = principal(property_id, department_id, permissions={Perm.TASKS_COMPLETE})
    task = Task(id=uuid4(), property_id=property_id, department_id=department_id,
                assignee_id=uuid4(), title="Clean room", status=TaskStatus.IN_PROGRESS)
    monkeypatch.setattr(staff_router.service, "get_task", lambda *args: task)
    with pytest.raises(Forbidden):
        staff_router.set_status(task.id, TaskStatusUpdate(status=TaskStatus.DONE), actor, Database())
    task.department_id = other_department
    with pytest.raises(HTTPException) as denied:
        staff_router.set_status(task.id, TaskStatusUpdate(status=TaskStatus.DONE), actor, Database())
    assert denied.value.status_code == 404


def test_manager_cannot_read_unrelated_department_reports():
    property_id, own, other = uuid4(), uuid4(), uuid4()
    manager = principal(property_id, own, role=Role.MANAGER,
                        permissions={Perm.REPORTS_READ})
    with pytest.raises(HTTPException) as denied:
        staff_router.department_reports(other, manager, Database())
    assert denied.value.status_code == 403


def test_cross_department_performance_is_hidden_from_manager():
    property_id, department_id = uuid4(), uuid4()
    manager = principal(property_id, department_id, role=Role.MANAGER)
    db = SimpleNamespace(scalar=lambda query: uuid4())
    assert not staff_reviews_router._performance_visible(db, manager, uuid4(), department_id)


def test_housekeeping_defect_routes_to_maintenance_manager_and_order(monkeypatch):
    property_id, housekeeping_id, maintenance_id, room_id = uuid4(), uuid4(), uuid4(), uuid4()
    reporter_id, manager_id = uuid4(), uuid4()
    housekeeping = Department(id=housekeeping_id, property_id=property_id,
                              key="housekeeping", name="Housekeeping")
    engineering = Department(id=maintenance_id, property_id=property_id,
                             key="maintenance", name="Engineering")
    room = Room(id=room_id, property_id=property_id, category_id=uuid4(),
                number="204", status=RoomStatus.DIRTY, qr_secret="x")
    manager = SimpleNamespace(id=manager_id, property_id=property_id,
                              role=SimpleNamespace(key="manager"), is_active=True)
    db = Database(rows=[engineering, [manager]], objects={
        (Department, housekeeping_id): housekeeping,
        (Department, maintenance_id): engineering,
        (Room, room_id): room,
    })
    monkeypatch.setattr(reporting.bus, "publish", lambda *a, **k: None)
    report = reporting.create_report(db, property_id, reporter_id, ReportCreate(
        department_id=housekeeping_id, category="room_defect", summary="AC not cooling",
        room_id=room_id, evidence=["/uploads/ac.webp"],
    ))
    order = next(row for row in db.added if isinstance(row, WorkOrder))
    assert report.reporter_department_id == housekeeping_id
    assert report.department_id == maintenance_id
    assert report.responsible_manager_id == manager_id
    assert report.work_order_id == order.id
    assert order.source_issue_id == report.id
    assert order.department_id == maintenance_id


def test_linked_maintenance_completion_closes_report_and_task(monkeypatch):
    property_id, department_id = uuid4(), uuid4()
    order = WorkOrder(id=uuid4(), property_id=property_id, department_id=department_id,
                      room_id=uuid4(), source_issue_id=uuid4(), task_id=uuid4(),
                      title="Repair AC", status=WorkOrderStatus.OPEN)
    report = IssueReport(id=order.source_issue_id, property_id=property_id,
                         department_id=department_id, summary="AC not cooling",
                         status=IssueStatus.SCHEDULED)
    task = Task(id=order.task_id, property_id=property_id, department_id=department_id,
                title="Repair AC", status=TaskStatus.IN_PROGRESS)
    db = Database(rows=[order, report, task])
    monkeypatch.setattr(maintenance.property_client, "post", lambda *a, **k: None)
    maintenance.complete_work_order(db, property_id, order.id,
                                    actual_cost=Decimal("20"), notes="Repaired")
    assert order.status == WorkOrderStatus.COMPLETED
    assert report.status == IssueStatus.RESOLVED
    assert task.status == TaskStatus.DONE


def test_responsible_manager_approves_linked_work_order():
    property_id, department_id, manager_id = uuid4(), uuid4(), uuid4()
    order = WorkOrder(id=uuid4(), property_id=property_id, department_id=department_id,
                      room_id=uuid4(), title="Repair AC", status=WorkOrderStatus.OPEN)
    report = IssueReport(id=uuid4(), property_id=property_id,
                         department_id=department_id, responsible_manager_id=manager_id,
                         work_order_id=order.id, summary="AC not cooling",
                         status=IssueStatus.REPORTED)
    db = Database(rows=[report], objects={(WorkOrder, order.id): order})
    reporting.approve_report(db, property_id, report.id, manager_id, IssueStatus.SCHEDULED)
    assert report.status == IssueStatus.SCHEDULED
    assert order.status == WorkOrderStatus.SCHEDULED
