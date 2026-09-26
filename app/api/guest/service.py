"""QR sessions, guest requests with SLA routing, issue reports and ratings."""
from __future__ import annotations

import logging
import secrets
from datetime import timedelta
from decimal import Decimal
from difflib import SequenceMatcher
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from vesper_common.clients import frontdesk, property_client
from vesper_common.clock import utcnow
from vesper_common.config import settings
from vesper_common.errors import Conflict, Forbidden, Invalid, NotFound
from vesper_common.events import Event, bus
from vesper_common.security import create_guest_token
from app.api.frontdesk.models import Stay
from app.api.inventory.models import StockItem
from app.api.property.models import Property, Room

from .models import Guest, IssueReport, IssueStatus, MenuItem, QrScan, RequestKind, RequestStatus, ServiceRequest

log = logging.getLogger(__name__)

# Which department answers which kind of request. Resolved to a real department_id via
# property-service at request time, because department keys are seeded per property.
KIND_TO_DEPARTMENT = {
    RequestKind.ROOM_SERVICE: "fnb",
    RequestKind.HOUSEKEEPING: "housekeeping",
    RequestKind.AMENITIES: "housekeeping",
    RequestKind.MAINTENANCE: "maintenance",
    RequestKind.OTHER: "front_office",
}

# Fallback promise per kind when the department has not set its own SLA.
DEFAULT_SLA_MINUTES = {
    RequestKind.ROOM_SERVICE: 40,
    RequestKind.HOUSEKEEPING: 30,
    RequestKind.AMENITIES: 20,
    RequestKind.MAINTENANCE: 60,
    RequestKind.OTHER: 30,
}

# Two reports of the same thing in the same place within this window are one problem.
DUPLICATE_WINDOW_HOURS = 12
DUPLICATE_SIMILARITY = 0.72


# --- QR session -------------------------------------------------------------------


def open_session(db: Session, scan, *, user_agent: str | None = None) -> dict:
    """Validate a nightstand QR and mint a guest token.

    The QR encodes the property, the room and a secret. Two checks, both necessary: the
    secret must match the room's current secret (rotated on every check-out, so a
    photographed QR dies with the stay), and the room must have an open stay right now.
    """
    room = property_client.get(f"/rooms/{scan.room_id}/qr", property_id=scan.property_id)
    if room is None:
        raise NotFound("Room not found")
    if not secrets.compare_digest(str(room.get("qr_secret", "")), scan.qr_secret):
        _record_scan(db, scan.room_id, None, scan.property_id, user_agent, accepted=False)
        raise Forbidden("This QR code is no longer valid")

    stay = frontdesk.get(
        "/stays/by-room", property_id=scan.property_id, params={"room_id": str(scan.room_id)}
    )
    if not stay or not stay.get("id"):
        _record_scan(db, scan.room_id, None, scan.property_id, user_agent, accepted=False)
        raise Forbidden("This room is not checked in — please contact the front desk")

    _record_scan(db, scan.room_id, stay["id"], scan.property_id, user_agent, accepted=True)
    token = create_guest_token(
        stay_id=stay["id"],
        room_id=str(scan.room_id),
        property_id=str(scan.property_id),
        guest_id=stay.get("guest_id"),
    )
    return {
        "token": token,
        "expires_in": settings.guest_token_minutes * 60,
        "room_number": room["number"],
        "property_name": stay["property_name"],
        "guest_name": stay.get("guest_name"),
        "stay_id": stay["id"],
    }


def _record_scan(db: Session, room_id, stay_id, property_id, user_agent, *, accepted: bool) -> None:
    if property_id is None:
        return  # nothing to attribute the scan to yet
    db.add(
        QrScan(
            property_id=property_id,
            room_id=room_id,
            stay_id=UUID(stay_id) if stay_id else None,
            scanned_at=utcnow(),
            user_agent=(user_agent or "")[:200] or None,
            accepted=accepted,
        )
    )
    db.commit()


def assert_stay_open(stay_id: str, property_id: str, *, room_id: str | None = None,
                     guest_id: str | None = None) -> dict:
    """Re-checked on every guest write: a token outliving its stay must stop working."""
    stay = frontdesk.get(f"/stays/{stay_id}", property_id=property_id)
    if stay is None:
        raise Forbidden("Your session has ended")
    if stay.get("status") != "in_house":
        raise Forbidden("This stay has been checked out")
    if (str(stay.get("property_id")) != str(property_id)
            or (room_id is not None and str(stay.get("room_id")) != str(room_id))
            or (guest_id is not None and str(stay.get("guest_id")) != str(guest_id))):
        raise Forbidden("This session does not belong to the active stay")
    return stay


# --- menu -------------------------------------------------------------------------


def menu(db: Session, property_id: UUID) -> dict:
    property_row = db.get(Property, property_id)
    if property_row is None:
        raise NotFound("Property not found")
    query = (
        select(MenuItem)
        .where(MenuItem.property_id == property_id)
        .order_by(MenuItem.category, MenuItem.name)
    )
    items = list(db.scalars(query))

    stock_ids: set[UUID] = set()
    for item in items:
        if item.recipe:
            for sid_str in item.recipe.keys():
                try:
                    stock_ids.add(UUID(str(sid_str)))
                except (ValueError, TypeError):
                    pass

    stock_map: dict[UUID, Decimal] = {}
    if stock_ids:
        stocks = db.scalars(
            select(StockItem).where(
                StockItem.property_id == property_id,
                StockItem.id.in_(stock_ids),
            )
        )
        stock_map = {s.id: s.quantity for s in stocks}

    grouped: dict[str, list[dict]] = {}
    for item in items:
        effective_available = bool(item.is_available)
        if effective_available and item.recipe:
            for sid_str, needed in item.recipe.items():
                try:
                    sid = UUID(str(sid_str))
                    available_qty = stock_map.get(sid)
                    if available_qty is not None and available_qty < Decimal(str(needed)):
                        effective_available = False
                        break
                except (ValueError, TypeError):
                    continue

        item_dict = {
            "id": item.id,
            "category": item.category,
            "name": item.name,
            "description": item.description,
            "price": item.price,
            "is_veg": item.is_veg,
            "prep_minutes": item.prep_minutes,
            "is_available": effective_available,
        }
        grouped.setdefault(item.category, []).append(item_dict)

    return {"currency": property_row.currency, "categories": grouped}


# --- requests ---------------------------------------------------------------------


def create_request(
    db: Session,
    *,
    property_id: UUID,
    stay_id: UUID,
    room_id: UUID,
    room_number: str,
    guest_id: UUID | None,
    data,
    actor_id: str | None = None,
    source_message_id: UUID | None = None,
    department_id_override: UUID | None = None,
    sla_minutes_override: int | None = None,
) -> ServiceRequest:
    if source_message_id is not None:
        existing = db.scalars(select(ServiceRequest).where(
            ServiceRequest.property_id == property_id,
            ServiceRequest.source_message_id == source_message_id,
        )).first()
        if existing is not None:
            return existing
    department_key = KIND_TO_DEPARTMENT[data.kind]
    department = None if department_id_override else _department(property_id, department_key)
    sla = sla_minutes_override or (department or {}).get("default_sla_minutes") or DEFAULT_SLA_MINUTES[data.kind]

    lines, total = _price_order(db, property_id, data)

    # Prevent duplicate requests from rapid repeated taps or retries within 30 seconds
    recent_cutoff = utcnow() - timedelta(seconds=30)
    existing_candidates = list(
        db.scalars(
            select(ServiceRequest).where(
                ServiceRequest.property_id == property_id,
                ServiceRequest.stay_id == stay_id,
                ServiceRequest.kind == data.kind.value,
                ServiceRequest.created_at >= recent_cutoff,
                ServiceRequest.status == RequestStatus.RAISED,
            ).order_by(ServiceRequest.created_at.desc())
        )
    )
    for existing in existing_candidates:
        if (existing.note or "").strip() == (data.note or "").strip():
            existing_items = sorted(
                [(str(i.get("menu_item_id")), int(i.get("quantity", 0))) for i in (existing.items or [])]
            )
            new_items = sorted(
                [(str(i.menu_item_id), int(i.quantity)) for i in (data.items or [])]
            )
            if existing_items == new_items:
                log.info("Duplicate request suppressed for stay %s (existing id %s)", stay_id, existing.id)
                return existing

    request = ServiceRequest(
        property_id=property_id,
        stay_id=stay_id,
        room_id=room_id,
        room_number=room_number,
        guest_id=guest_id,
        department_id=department_id_override or (UUID(department["id"]) if department else None),
        source_message_id=source_message_id,
        kind=data.kind.value,
        note=data.note,
        items=lines,
        total_amount=total,
        sla_minutes=sla,
        due_at=utcnow() + timedelta(minutes=sla),
    )
    db.add(request)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if source_message_id is not None:
            existing = db.scalars(select(ServiceRequest).where(
                ServiceRequest.property_id == property_id,
                ServiceRequest.source_message_id == source_message_id,
            )).first()
            if existing is not None:
                return existing
        raise
    db.refresh(request)

    # staff-service turns this into a task; notification-service pushes it to phones.
    bus.publish(
        Event.REQUEST_RAISED,
        {
            "request_id": str(request.id),
            "kind": request.kind,
            "room_id": str(room_id),
            "room_number": room_number,
            "stay_id": str(stay_id),
            "guest_id": str(guest_id) if guest_id else None,
            "department_id": str(request.department_id) if request.department_id else None,
            "sla_minutes": sla,
            "priority": "high" if data.kind == RequestKind.ROOM_SERVICE else "normal",
            "items": lines,
            "note": data.note,
            "total_amount": float(total),
        },
        property_id=str(property_id),
        actor_id=actor_id,
    )
    return request


def _price_order(db: Session, property_id: UUID, data) -> tuple[list[dict], Decimal]:
    if not data.items:
        return [], Decimal("0")
    wanted = {line.menu_item_id: line.quantity for line in data.items}
    items = list(
        db.scalars(
            select(MenuItem).where(
                MenuItem.property_id == property_id, MenuItem.id.in_(wanted.keys())
            )
        )
    )
    found = {item.id for item in items}
    missing = sorted(str(i) for i in wanted.keys() - found)
    if missing:
        raise Invalid("Some items are no longer on the menu", details={"menu_item_ids": missing})

    stock_ids: set[UUID] = set()
    for item in items:
        if item.recipe:
            for sid_str in item.recipe.keys():
                try:
                    stock_ids.add(UUID(str(sid_str)))
                except (ValueError, TypeError):
                    pass

    stock_map: dict[UUID, Decimal] = {}
    if stock_ids:
        stocks = db.scalars(
            select(StockItem).where(
                StockItem.property_id == property_id,
                StockItem.id.in_(stock_ids),
            )
        )
        stock_map = {s.id: s.quantity for s in stocks}

    lines: list[dict] = []
    total = Decimal("0")
    for item in items:
        if not item.is_available:
            raise Invalid(f"{item.name} is unavailable right now")
        quantity = wanted[item.id]
        if item.recipe:
            for sid_str, per_portion in item.recipe.items():
                try:
                    sid = UUID(str(sid_str))
                    needed = Decimal(str(per_portion)) * Decimal(str(quantity))
                    available_qty = stock_map.get(sid)
                    if available_qty is not None and available_qty < needed:
                        raise Invalid(f"{item.name} is sold out and unavailable to order")
                except (ValueError, TypeError):
                    continue

        line_total = item.price * quantity
        total += line_total
        lines.append(
            {
                "menu_item_id": str(item.id),
                "name": item.name,
                "quantity": quantity,
                "unit_price": float(item.price),
                "line_total": float(line_total),
                # Carried on the event so inventory can deduct without asking us back.
                "recipe": item.recipe,
            }
        )
    return lines, total


def get_request(db: Session, property_id: UUID, request_id: UUID) -> ServiceRequest:
    query = select(ServiceRequest).where(
        ServiceRequest.id == request_id, ServiceRequest.property_id == property_id
    )
    request = db.scalars(query).first()
    if request is None:
        raise NotFound("Request not found")
    return request


def list_stay_requests(db: Session, property_id: UUID, stay_id: UUID) -> list[ServiceRequest]:
    """The guest's live tracker."""
    query = (
        select(ServiceRequest)
        .where(ServiceRequest.property_id == property_id, ServiceRequest.stay_id == stay_id)
        .order_by(ServiceRequest.created_at.desc())
    )
    return list(db.scalars(query))


def staff_who_served(db: Session, property_id: UUID, stay_id: UUID) -> list[dict]:
    """Who actually attended to this stay.

    The people who accepted a request for this room, deduplicated, most recent first.
    This is the list a guest may rate, and restricting it here is what keeps ratings
    about service received rather than about who happens to be well known — a guest
    cannot rate the general manager they never met.

    Names are resolved by the caller; this returns ids and what each person did, which
    is everything guest-service actually knows.
    """
    rows = db.scalars(
        select(ServiceRequest)
        .where(
            ServiceRequest.property_id == property_id,
            ServiceRequest.stay_id == stay_id,
            ServiceRequest.accepted_by.is_not(None),
        )
        .order_by(ServiceRequest.created_at.desc())
    )

    seen: dict[str, dict] = {}
    for request in rows:
        key = str(request.accepted_by)
        entry = seen.setdefault(
            key,
            {
                "staff_id": key,
                "department_id": str(request.department_id) if request.department_id else None,
                "interactions": [],
            },
        )
        # Cap the list: a guest deciding whether to rate someone needs a reminder of who
        # they were, not an audit log of the stay.
        if len(entry["interactions"]) < 4:
            entry["interactions"].append(request.kind)

    return list(seen.values())


def list_requests(
    db: Session,
    property_id: UUID,
    *,
    department_id: UUID | None = None,
    status: str | None = None,
    open_only: bool = True,
) -> list[ServiceRequest]:
    """The staff inbox."""
    query = select(ServiceRequest).where(ServiceRequest.property_id == property_id)
    if department_id:
        query = query.where(ServiceRequest.department_id == department_id)
    if status:
        query = query.where(ServiceRequest.status == status)
    elif open_only:
        query = query.where(
            ServiceRequest.status.notin_([RequestStatus.DELIVERED, RequestStatus.CANCELLED])
        )
    return list(db.scalars(query.order_by(ServiceRequest.due_at)))


def accept_request(db: Session, property_id: UUID, request_id: UUID, user_id: UUID) -> ServiceRequest:
    request = get_request(db, property_id, request_id)
    if request.status != RequestStatus.RAISED:
        raise Conflict("That request has already been picked up")
    request.status = RequestStatus.ACCEPTED
    request.accepted_at = utcnow()
    request.accepted_by = user_id
    db.commit()
    db.refresh(request)
    bus.publish(
        Event.REQUEST_ACCEPTED,
        {
            "request_id": str(request.id),
            "stay_id": str(request.stay_id),
            "room_number": request.room_number,
            "accepted_by": str(user_id),
            "minutes_to_accept": int((request.accepted_at - request.created_at).total_seconds() // 60),
        },
        property_id=str(property_id),
        actor_id=str(user_id),
    )
    return request


def set_request_status(
    db: Session, property_id: UUID, request_id: UUID, new_status: str, *, actor_id: str
) -> ServiceRequest:
    request = get_request(db, property_id, request_id)
    if request.status in {RequestStatus.DELIVERED, RequestStatus.CANCELLED}:
        raise Conflict("That request is already closed")

    request.status = new_status
    if new_status == RequestStatus.DELIVERED:
        request.delivered_at = utcnow()
    db.commit()
    db.refresh(request)

    if new_status == RequestStatus.DELIVERED:
        # Inventory deducts the recipe off the back of this one.
        bus.publish(
            Event.REQUEST_DELIVERED,
            {
                "request_id": str(request.id),
                "kind": request.kind,
                "stay_id": str(request.stay_id),
                "guest_id": str(request.guest_id) if request.guest_id else None,
                "room_number": request.room_number,
                "items": request.items,
                "total_amount": float(request.total_amount),
                "minutes_to_deliver": int(
                    (request.delivered_at - request.created_at).total_seconds() // 60
                ),
                "within_sla": request.delivered_at <= request.due_at,
            },
            property_id=str(property_id),
            actor_id=actor_id,
        )
    return request


def rate_request(db: Session, property_id: UUID, request_id: UUID, stay_id: UUID, data) -> ServiceRequest:
    request = get_request(db, property_id, request_id)
    if request.stay_id != stay_id:
        raise Forbidden("That request belongs to another room")
    if request.status != RequestStatus.DELIVERED:
        raise Conflict("You can rate this once it has been delivered")
    if request.rating is not None:
        raise Conflict("You have already rated this")

    request.rating = data.rating
    request.rating_comment = data.comment
    request.rated_at = utcnow()
    db.commit()
    db.refresh(request)

    # guest-intel scores the sentiment of the comment off this event.
    bus.publish(
        Event.REQUEST_RATED,
        {
            "request_id": str(request.id),
            "guest_id": str(request.guest_id) if request.guest_id else None,
            "stay_id": str(stay_id),
            "department_id": str(request.department_id) if request.department_id else None,
            "kind": request.kind,
            "rating": data.rating,
            "comment": data.comment,
        },
        property_id=str(property_id),
    )
    return request


def sweep_overdue(db: Session, property_id: UUID) -> list[ServiceRequest]:
    """Called on a timer by notification-service. Alerts once per request, not per tick."""
    now = utcnow()
    query = select(ServiceRequest).where(
        ServiceRequest.property_id == property_id,
        ServiceRequest.status.notin_([RequestStatus.DELIVERED, RequestStatus.CANCELLED]),
        ServiceRequest.due_at < now,
        ServiceRequest.overdue_notified_at.is_(None),
    )
    overdue = list(db.scalars(query))
    for request in overdue:
        request.overdue_notified_at = now
    db.commit()

    for request in overdue:
        bus.publish(
            Event.REQUEST_OVERDUE,
            {
                "request_id": str(request.id),
                "kind": request.kind,
                "room_number": request.room_number,
                "department_id": str(request.department_id) if request.department_id else None,
                "overdue_by_minutes": int((now - request.due_at).total_seconds() // 60),
            },
            property_id=str(property_id),
        )
    return overdue


# --- issues -----------------------------------------------------------------------


def report_issue(
    db: Session,
    property_id: UUID,
    data,
    *,
    reported_by: UUID | None,
    by_guest: bool = False,
) -> IssueReport:
    room_number = None
    department_id = None
    if data.room_id:
        room = property_client.get(f"/rooms/{data.room_id}", property_id=property_id)
        if room is None:
            raise NotFound("Room not found at this property")
        room_number = room.get("number")
    if data.asset_id:
        from app.api.property.models import Asset
        asset = db.get(Asset, data.asset_id)
        if asset is None or asset.property_id != property_id:
            raise NotFound("Asset not found at this property")
    department = _department(property_id, "maintenance")
    if department:
        department_id = UUID(department["id"])
    if department_id is None:
        raise Conflict("No maintenance department is configured")
    from app.api.staff.reporting import _manager
    manager_id = _manager(db, property_id, department_id)

    existing = _find_duplicate(db, property_id, data, room_number)
    if existing is not None:
        existing.duplicate_count += 1
        # A second pair of eyes on the same fault is a signal, not noise.
        if data.severity == "high" and existing.severity != "high":
            existing.severity = "high"
        db.commit()
        db.refresh(existing)
        duplicate = IssueReport(
            property_id=property_id,
            room_id=data.room_id,
            room_number=room_number,
            asset_id=data.asset_id,
            department_id=department_id,
            responsible_manager_id=manager_id,
            reported_by=reported_by,
            reported_by_guest=by_guest,
            summary=data.summary,
            description=data.description,
            category=data.category,
            severity=data.severity,
            photo_url=data.photo_url,
            evidence=[data.photo_url] if data.photo_url else [],
            status=IssueStatus.MERGED,
            merged_into_id=existing.id,
        )
        db.add(duplicate)
        db.commit()
        db.refresh(duplicate)
        return duplicate

    issue = IssueReport(
        property_id=property_id,
        room_id=data.room_id,
        room_number=room_number,
        asset_id=data.asset_id,
        department_id=department_id,
        responsible_manager_id=manager_id,
        reported_by=reported_by,
        reported_by_guest=by_guest,
        summary=data.summary,
        description=data.description,
        category=data.category,
        severity=data.severity,
        photo_url=data.photo_url,
        evidence=[data.photo_url] if data.photo_url else [],
    )
    db.add(issue)
    db.flush()
    if issue.room_id:
        from app.api.maintenance.models import WorkOrder, WorkOrderKind
        order = WorkOrder(
            property_id=property_id,
            room_id=issue.room_id,
            source_issue_id=issue.id,
            department_id=department_id,
            title=issue.summary,
            description=issue.description,
            kind=WorkOrderKind.CORRECTIVE,
            priority="high" if issue.severity == "high" else "normal",
        )
        db.add(order)
        db.flush()
        issue.work_order_id = order.id
    db.commit()
    db.refresh(issue)

    bus.publish(
        Event.ISSUE_REPORTED,
        {
            "issue_id": str(issue.id),
            "summary": issue.summary,
            "description": issue.description,
            "category": issue.category,
            "severity": issue.severity,
            "room_id": str(issue.room_id) if issue.room_id else None,
            "room_number": room_number,
            "asset_id": str(issue.asset_id) if issue.asset_id else None,
            "department_id": str(department_id) if department_id else None,
            "photo_url": issue.photo_url,
            "work_order_id": str(issue.work_order_id) if issue.work_order_id else None,
            "priority": "urgent" if issue.severity == "high" else "normal",
        },
        property_id=str(property_id),
        actor_id=str(reported_by) if reported_by else None,
    )
    return issue


def _find_duplicate(db: Session, property_id: UUID, data, room_number: str | None) -> IssueReport | None:
    """Same place, same kind, recent, and a similar summary.

    Deliberately string similarity rather than an embedding: "AC not cooling" and "AC is
    not cooling" is the case that actually happens, and a housekeeper should not wait on
    a model round-trip to file a report.
    """
    since = utcnow() - timedelta(hours=DUPLICATE_WINDOW_HOURS)
    query = select(IssueReport).where(
        IssueReport.property_id == property_id,
        IssueReport.status.in_([IssueStatus.REPORTED, IssueStatus.SCHEDULED]),
        IssueReport.created_at >= since,
        IssueReport.category == data.category,
    )
    if data.asset_id:
        query = query.where(IssueReport.asset_id == data.asset_id)
    elif data.room_id:
        query = query.where(IssueReport.room_id == data.room_id)
    else:
        return None

    needle = data.summary.lower().strip()
    for candidate in db.scalars(query.order_by(IssueReport.created_at.desc())):
        score = SequenceMatcher(None, needle, candidate.summary.lower().strip()).ratio()
        if score >= DUPLICATE_SIMILARITY:
            return candidate
    return None


def list_issues(db: Session, property_id: UUID, *, status: str | None = None) -> list[IssueReport]:
    query = select(IssueReport).where(
        IssueReport.property_id == property_id, IssueReport.merged_into_id.is_(None)
    )
    if status:
        query = query.where(IssueReport.status == status)
    return list(db.scalars(query.order_by(IssueReport.created_at.desc())))


def set_issue_status(db: Session, property_id: UUID, issue_id: UUID, new_status: str) -> IssueReport:
    query = select(IssueReport).where(
        IssueReport.id == issue_id, IssueReport.property_id == property_id
    )
    issue = db.scalars(query).first()
    if issue is None:
        raise NotFound("Issue not found")
    allowed = {
        IssueStatus.REPORTED: {IssueStatus.SCHEDULED},
        IssueStatus.SCHEDULED: {IssueStatus.RESOLVED},
    }
    if new_status not in allowed.get(issue.status, set()):
        raise Conflict("Invalid issue status transition")
    if new_status == IssueStatus.SCHEDULED and issue.work_order_id:
        from app.api.maintenance.models import WorkOrder, WorkOrderStatus
        order = db.get(WorkOrder, issue.work_order_id)
        if order is None or order.property_id != property_id or order.status != WorkOrderStatus.OPEN:
            raise Conflict("Linked work order is unavailable for approval")
        order.status = WorkOrderStatus.SCHEDULED
    if new_status == IssueStatus.RESOLVED and issue.work_order_id:
        from app.api.maintenance.models import WorkOrder, WorkOrderStatus
        order = db.get(WorkOrder, issue.work_order_id)
        if order is None or order.status != WorkOrderStatus.COMPLETED:
            raise Conflict("Complete the linked work order first")
    issue.status = new_status
    if new_status == IssueStatus.RESOLVED:
        issue.resolved_at = utcnow()
    db.commit()
    db.refresh(issue)
    return issue


# --- guests -----------------------------------------------------------------------


def get_guest(db: Session, property_id: UUID, guest_id: UUID) -> Guest:
    query = select(Guest).where(Guest.id == guest_id, Guest.property_id == property_id)
    guest_row = db.scalars(query).first()
    if guest_row is None:
        raise NotFound("Guest not found")
    return guest_row


def list_guests(db: Session, property_id: UUID, *, search: str | None = None) -> list[Guest]:
    query = select(Guest).where(Guest.property_id == property_id)
    if search:
        needle = f"%{search.lower()}%"
        query = query.where(Guest.full_name.ilike(needle) | Guest.email.ilike(needle))
    return list(db.scalars(query.order_by(Guest.full_name).limit(200)))


def create_guest(db: Session, property_id: UUID, data) -> Guest:
    guest_row = Guest(property_id=property_id, **data.model_dump())
    db.add(guest_row)
    db.commit()
    db.refresh(guest_row)
    return guest_row


def _department(property_id: UUID, key: str) -> dict | None:
    departments = property_client.get("/property/departments", property_id=property_id) or []
    for department in departments:
        if department.get("key") == key:
            return department
    log.warning("no '%s' department configured for property %s", key, property_id)
    return None


def list_active_checked_in_rooms(db: Session) -> list[dict]:
    """Return real checked-in rooms with valid QR access secrets for guest testing/cards."""
    stays = list(
        db.scalars(
            select(Stay)
            .where(Stay.status == "in_house")
            .order_by(Stay.checked_in_at.desc())
        )
    )
    results: list[dict] = []
    for stay in stays:
        room = db.get(Room, stay.room_id)
        if not room:
            continue
        guest = db.get(Guest, stay.guest_id) if stay.guest_id else None
        prop = db.get(Property, stay.property_id)
        results.append(
            {
                "property_id": str(stay.property_id),
                "property_name": prop.name if prop else "Vesper Luxury Resort",
                "room_id": str(stay.room_id),
                "room_number": stay.room_number,
                "qr_secret": room.qr_secret,
                "guest_name": guest.full_name if guest else "In-Room Guest",
                "stay_id": str(stay.id),
                "category": room.category.name if room.category else "Standard Room",
                "floor": room.floor,
            }
        )
    return results

