"""Department-owned operational reports and maintenance escalation."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from vesper_common.clock import utcnow
from vesper_common.errors import Conflict, Forbidden, NotFound
from vesper_common.events import Event, bus

from app.api.guest.models import IssueReport, IssueStatus
from app.api.identity.models import User, UserAssignment
from app.api.property.models import Department, Room
from app.api.maintenance.models import WorkOrder, WorkOrderKind
from app.api.maintenance.models import WorkOrderStatus


def _manager(db: Session, property_id: UUID, department_id: UUID) -> UUID:
    department = db.get(Department, department_id)
    if department is None or department.property_id != property_id:
        raise NotFound("Responsible department not found")
    managers = db.scalars(
        select(User).join(UserAssignment, UserAssignment.user_id == User.id)
        .where(UserAssignment.property_id == property_id,
               UserAssignment.department_id == department_id,
               User.is_active.is_(True))
        .order_by(User.id)
    ).all()
    candidates = [u for u in managers if u.role.key == "manager"]
    if department.head_user_id:
        headed = next((u for u in candidates if u.id == department.head_user_id), None)
        if headed:
            return headed.id
    if candidates:
        return candidates[0].id
    raise Conflict("Responsible department has no assigned manager")


def create_report(db: Session, property_id: UUID, reporter_id: UUID, data) -> IssueReport:
    source = db.get(Department, data.department_id)
    if source is None or source.property_id != property_id:
        raise NotFound("Reporting department not found")
    destination = source
    room = None
    if data.room_id is not None:
        room = db.get(Room, data.room_id)
        if room is None or room.property_id != property_id:
            raise NotFound("Room not found")
    if data.category == "room_defect":
        if room is None:
            raise Conflict("Room defects require a room")
        # Engineering remains the owner when maintenance is its own department.
        destination = db.scalars(select(Department).where(
            Department.property_id == property_id, Department.key == "maintenance"
        )).first()
        if destination is None:
            raise Conflict("No maintenance department is configured")

    manager_id = _manager(db, property_id, destination.id)
    report = IssueReport(
        property_id=property_id,
        room_id=data.room_id,
        room_number=room.number if room else None,
        department_id=destination.id,
        reporter_department_id=source.id,
        responsible_manager_id=manager_id,
        reported_by=reporter_id,
        reported_by_guest=False,
        summary=data.summary,
        description=data.description,
        category=data.category,
        severity=data.severity,
        photo_url=data.evidence[0] if data.evidence else None,
        evidence=data.evidence,
    )
    db.add(report)
    db.flush()
    if data.category == "room_defect":
        order = WorkOrder(
            property_id=property_id,
            room_id=room.id,
            source_issue_id=report.id,
            department_id=destination.id,
            title=data.summary,
            description=data.description,
            kind=WorkOrderKind.CORRECTIVE,
            priority="high" if data.severity == "high" else "normal",
        )
        db.add(order)
        db.flush()
        report.work_order_id = order.id
    db.commit()
    db.refresh(report)
    bus.publish(Event.ISSUE_REPORTED, {
        "issue_id": str(report.id),
        "summary": report.summary,
        "description": report.description,
        "category": report.category,
        "severity": report.severity,
        "room_id": str(report.room_id) if report.room_id else None,
        "room_number": report.room_number,
        "department_id": str(report.department_id),
        "photo_url": report.photo_url,
        "work_order_id": str(report.work_order_id) if report.work_order_id else None,
        "priority": "high" if report.severity == "high" else "normal",
    }, property_id=str(property_id), actor_id=str(reporter_id))
    return report


def get_report(db: Session, property_id: UUID, report_id: UUID) -> IssueReport:
    report = db.scalars(select(IssueReport).where(
        IssueReport.id == report_id, IssueReport.property_id == property_id,
        IssueReport.reported_by_guest.is_(False),
    )).first()
    if report is None:
        raise NotFound("Report not found")
    return report


def list_reports(db: Session, property_id: UUID, *, department_id: UUID | None = None,
                 reporter_id: UUID | None = None) -> list[IssueReport]:
    query = select(IssueReport).where(
        IssueReport.property_id == property_id,
        IssueReport.reported_by_guest.is_(False),
        IssueReport.merged_into_id.is_(None),
    )
    if department_id is not None:
        query = query.where(IssueReport.department_id == department_id)
    if reporter_id is not None:
        query = query.where(IssueReport.reported_by == reporter_id)
    return list(db.scalars(query.order_by(IssueReport.created_at.desc())))


def approve_report(db: Session, property_id: UUID, report_id: UUID, actor_id: UUID,
                   new_status: str, *, allow_general_manager: bool = False) -> IssueReport:
    report = db.scalars(select(IssueReport).where(
        IssueReport.id == report_id, IssueReport.property_id == property_id,
        IssueReport.reported_by_guest.is_(False),
    ).with_for_update()).first()
    if report is None:
        raise NotFound("Report not found")
    if report.responsible_manager_id != actor_id and not allow_general_manager:
        raise Forbidden("Only the responsible manager may approve this report")
    if new_status != IssueStatus.SCHEDULED or report.status != IssueStatus.REPORTED:
        raise Conflict("Only reported work may be approved for scheduling")
    if report.work_order_id:
        order = db.get(WorkOrder, report.work_order_id)
        if order is None or order.property_id != property_id or order.status != WorkOrderStatus.OPEN:
            raise Conflict("Linked work order is unavailable for approval")
        order.status = WorkOrderStatus.SCHEDULED
    report.status = IssueStatus.SCHEDULED
    db.commit()
    db.refresh(report)
    return report
