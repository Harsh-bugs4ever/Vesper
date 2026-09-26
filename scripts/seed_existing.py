"""Fill gaps in an existing synthetic resort without resetting or duplicating it."""
from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import select

from vesper_common.clock import utcnow


def enrich_existing_demo(db, property_id: UUID) -> dict[str, int]:
    """Add only missing demo attendance, room-service tasks and a stocked recipe."""
    import vesper_models.frontdesk as frontdesk
    import vesper_models.guest as guest
    import vesper_models.identity as identity
    import vesper_models.inventory as inventory
    import vesper_models.property as prop
    import vesper_models.staff as staff

    resort = db.get(prop.Property, property_id)
    if resort is None or resort.name != "JW Marriott Mumbai, Juhu":
        raise ValueError("Existing seed enrichment is limited to the synthetic demo resort")

    counts = {"attendance_added": 0, "food_tasks_added": 0,
              "historical_orders_repaired": 0, "historical_orders_unmatched": 0,
              "stock_items_added": 0, "recipes_completed": 0}
    now = utcnow()
    local_tz = ZoneInfo(resort.timezone)
    today = now.astimezone(local_tz).date()

    staff_role = db.scalar(select(identity.Role).where(
        identity.Role.property_id == property_id, identity.Role.key == "staff"))
    morning = db.scalar(select(staff.Shift).where(
        staff.Shift.property_id == property_id, staff.Shift.key == "morning"))
    if staff_role is None or morning is None:
        raise ValueError("Demo staff role or morning shift is missing")
    people = list(db.scalars(select(identity.User).where(
        identity.User.property_id == property_id,
        identity.User.role_id == staff_role.id,
        identity.User.email.like("%@vesper.demo"))))
    recent_start = datetime.combine(today - timedelta(days=5), time.min)
    present = {(row.user_id, row.work_date.date()) for row in db.scalars(
        select(staff.Attendance).where(
            staff.Attendance.property_id == property_id,
            staff.Attendance.shift_id == morning.id,
            staff.Attendance.work_date >= recent_start,
        ))}
    for person in people:
        if person.department_id is None:
            continue
        for days_ago in range(5, 0, -1):
            work_day = today - timedelta(days=days_ago)
            if (person.id, work_day) in present:
                continue
            checked_in = datetime.combine(work_day, time(7, 5),
                                          tzinfo=local_tz).astimezone(timezone.utc)
            db.add(staff.Attendance(
                property_id=property_id, user_id=person.id,
                department_id=person.department_id, shift_id=morning.id,
                work_date=datetime.combine(work_day, time.min),
                checked_in_at=checked_in, checked_out_at=checked_in + timedelta(hours=8),
                method=staff.AttendanceMethod.MANUAL, worked_minutes=480,
                note="Synthetic demo attendance",
            ))
            counts["attendance_added"] += 1

    active_stays = list(db.scalars(select(frontdesk.Stay).where(
        frontdesk.Stay.property_id == property_id,
        frontdesk.Stay.status == frontdesk.StayStatus.IN_HOUSE)))
    if active_stays:
        requests = list(db.scalars(select(guest.ServiceRequest).where(
            guest.ServiceRequest.property_id == property_id,
            guest.ServiceRequest.kind == guest.RequestKind.ROOM_SERVICE,
            guest.ServiceRequest.stay_id.in_([stay.id for stay in active_stays]),
            guest.ServiceRequest.status != guest.RequestStatus.CANCELLED)))
        if requests:
            linked = set(db.scalars(select(staff.Task.source_ref).where(
                staff.Task.property_id == property_id,
                staff.Task.source == staff.TaskSource.GUEST_REQUEST,
                staff.Task.source_ref.in_([request.id for request in requests]))))
            for request in requests:
                if request.id in linked or request.department_id is None:
                    continue
                task_status = {
                    guest.RequestStatus.RAISED: staff.TaskStatus.OPEN,
                    guest.RequestStatus.ACCEPTED: staff.TaskStatus.ASSIGNED,
                    guest.RequestStatus.IN_PROGRESS: staff.TaskStatus.IN_PROGRESS,
                    guest.RequestStatus.DELIVERED: staff.TaskStatus.DONE,
                }.get(request.status)
                if task_status is None:
                    continue
                db.add(staff.Task(
                    property_id=property_id, department_id=request.department_id,
                    assignee_id=request.accepted_by, room_id=request.room_id,
                    title=f"Room service order — Room {request.room_number}",
                    description=request.note or "Prepare and deliver the room-service order.",
                    status=task_status, priority=staff.TaskPriority.HIGH,
                    source=staff.TaskSource.GUEST_REQUEST, source_ref=request.id,
                    due_at=request.due_at, accepted_at=request.accepted_at,
                    completed_at=request.delivered_at,
                    completed_by=request.accepted_by if request.delivered_at else None,
                    meta={"kind": "room_service", "items": request.items},
                    created_at=request.created_at,
                ))
                counts["food_tasks_added"] += 1

    # The old food seed used "Room-123" and unrelated UUIDs for historical
    # requests. Repair only that recognizable format when one booking matches.
    legacy_orders = db.scalars(select(guest.ServiceRequest).where(
        guest.ServiceRequest.property_id == property_id,
        guest.ServiceRequest.kind == guest.RequestKind.ROOM_SERVICE,
        guest.ServiceRequest.room_number.like("Room-%")))
    rooms_by_category: dict[UUID, list] = {}
    for room in db.scalars(select(prop.Room).where(prop.Room.property_id == property_id)):
        rooms_by_category.setdefault(room.category_id, []).append(room)
    for request in legacy_orders:
        if not request.room_number.startswith("Room-") or request.guest_id is None:
            continue
        request_day = request.created_at.astimezone(local_tz).date()
        candidates = list(db.scalars(select(frontdesk.Booking).where(
            frontdesk.Booking.property_id == property_id,
            frontdesk.Booking.guest_id == request.guest_id,
            frontdesk.Booking.room_category_id == request.room_id,
            frontdesk.Booking.status == frontdesk.BookingStatus.CHECKED_OUT,
            frontdesk.Booking.check_in_date >= request_day - timedelta(days=2),
            frontdesk.Booking.check_in_date <= request_day + timedelta(days=2),
        )))
        if len(candidates) != 1 or not rooms_by_category.get(request.room_id):
            counts["historical_orders_unmatched"] += 1
            continue
        booking = candidates[0]
        stay = db.scalar(select(frontdesk.Stay).where(
            frontdesk.Stay.property_id == property_id,
            frontdesk.Stay.booking_id == booking.id))
        if stay is None:
            room = rooms_by_category[booking.room_category_id][0]
            checked_in = datetime.combine(booking.check_in_date, time(14),
                                          tzinfo=local_tz).astimezone(timezone.utc)
            checked_out = datetime.combine(booking.check_out_date, time(11),
                                           tzinfo=local_tz).astimezone(timezone.utc)
            stay = frontdesk.Stay(
                id=uuid4(), property_id=property_id, booking_id=booking.id,
                guest_id=booking.guest_id, room_id=room.id, room_number=room.number,
                checked_in_at=checked_in, checked_out_at=checked_out,
                status=frontdesk.StayStatus.CHECKED_OUT,
                folio_total=booking.total_amount,
                notes="Repaired synthetic historical room-service stay",
            )
            db.add(stay)
        request.stay_id = stay.id
        request.room_id = stay.room_id
        request.room_number = stay.room_number
        if booking.room_id is None:
            booking.room_id = stay.room_id
        visits = list(db.scalars(select(frontdesk.GuestVisit).where(
            frontdesk.GuestVisit.property_id == property_id,
            frontdesk.GuestVisit.guest_id == request.guest_id,
            frontdesk.GuestVisit.kind == frontdesk.VisitKind.ROOM_SERVICE,
            frontdesk.GuestVisit.occurred_on == booking.check_in_date,
            frontdesk.GuestVisit.amount == request.total_amount,
            frontdesk.GuestVisit.stay_id.is_(None))))
        if len(visits) == 1:
            visits[0].stay_id = stay.id
            visits[0].outlet = "In-room dining"
            visits[0].meta = {**(visits[0].meta or {}), "request_id": str(request.id)}
        counts["historical_orders_repaired"] += 1

    lime = db.scalar(select(inventory.StockItem).where(
        inventory.StockItem.property_id == property_id,
        inventory.StockItem.sku == "FD-LIME"))
    if lime is None:
        store = db.scalar(select(prop.Department).where(
            prop.Department.property_id == property_id, prop.Department.key == "store"))
        if store is None:
            raise ValueError("Demo store department is missing")
        lime = inventory.StockItem(
            property_id=property_id, department_id=store.id, sku="FD-LIME",
            name="Fresh Limes", category="food", unit="kg",
            quantity=Decimal("18"), minimum_quantity=Decimal("8"),
            reorder_quantity=Decimal("25"), unit_cost=Decimal("95"),
            supplier="Juhu Produce", lead_time_days=2,
            expires_on=today + timedelta(days=10),
        )
        db.add(lime)
        db.flush()
        counts["stock_items_added"] += 1
    for item in db.scalars(select(guest.MenuItem).where(
        guest.MenuItem.property_id == property_id,
        guest.MenuItem.name == "Fresh Lime Soda")):
        if not item.recipe:
            item.recipe = {str(lime.id): 0.08}
            counts["recipes_completed"] += 1
    return counts
