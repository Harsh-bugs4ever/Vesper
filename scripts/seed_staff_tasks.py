"""Assign one repeatable, department-scoped work item to every demo staff account."""
from __future__ import annotations

from datetime import timedelta
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import select

from vesper_common.clock import utcnow


def staff_assignment_id(property_id: UUID, user_id: UUID) -> UUID:
    return uuid5(NAMESPACE_URL, f"vesper:staff-assignment:v1:{property_id}:{user_id}")


def seed_staff_tasks(db, property_id: UUID) -> dict[str, int]:
    """Add one assigned task per synthetic staff user; caller owns the commit."""
    import vesper_models.identity as identity
    import vesper_models.inventory as inventory
    import vesper_models.property as prop
    import vesper_models.staff as staff

    resort = db.get(prop.Property, property_id)
    if resort is None or resort.name != "JW Marriott Mumbai, Juhu":
        raise ValueError("Staff task assignments are limited to the synthetic demo resort")
    role = db.scalar(select(identity.Role).where(
        identity.Role.property_id == property_id, identity.Role.key == "staff"))
    if role is None:
        raise ValueError("Demo staff role is missing")

    departments = {row.id: row.key for row in db.scalars(select(prop.Department).where(
        prop.Department.property_id == property_id))}
    people = sorted(db.scalars(select(identity.User).where(
        identity.User.property_id == property_id,
        identity.User.role_id == role.id,
        identity.User.email.like("%@vesper.demo"))), key=lambda user: user.email)
    rooms = list(db.scalars(select(prop.Room).where(
        prop.Room.property_id == property_id).order_by(prop.Room.number)))
    stock = list(db.scalars(select(inventory.StockItem).where(
        inventory.StockItem.property_id == property_id).order_by(inventory.StockItem.sku)))
    if not people or not rooms or not stock:
        raise ValueError("Demo staff, rooms or stock items are missing")
    missing_departments = {str(user.department_id) for user in people
                           if user.department_id not in departments}
    if missing_departments:
        raise ValueError(f"Demo staff have unknown departments: {sorted(missing_departments)}")

    positions: dict[str, int] = {}
    counts = {"staff_accounts": len(people), "tasks_added": 0, "already_present": 0}
    now = utcnow()
    for user in people:
        department = departments[user.department_id]
        position = positions.get(department, 0)
        positions[department] = position + 1
        task_id = staff_assignment_id(property_id, user.id)
        if db.get(staff.Task, task_id) is not None:
            counts["already_present"] += 1
            continue
        room_id = None
        if department == "housekeeping":
            room = rooms[position % len(rooms)]
            room_id = room.id
            title = f"Check room {room.number} amenities"
            description = "Verify towels, toiletries and room readiness; report any shortage."
        elif department == "fnb":
            title = f"Prepare service station {position + 1}"
            description = "Check clean serviceware, menu supplies and handover notes."
        elif department == "front_office":
            title = f"Review arrival handover batch {position + 1}"
            description = "Check the arrival checklist and flag any room-readiness issue."
        elif department == "maintenance":
            title = f"Inspect engineering zone {position + 1}"
            description = "Complete the safety checklist and report any defect."
        elif department == "store":
            item = stock[position % len(stock)]
            title = f"Count stock: {item.name}"
            description = f"Count {item.sku} on the shelf and report any discrepancy."
        elif department == "security":
            title = f"Complete security patrol {position + 1}"
            description = "Check access points and record any safety concern."
        else:
            raise ValueError(f"No demo task template for department {department}")
        db.add(staff.Task(
            id=task_id, property_id=property_id,
            department_id=user.department_id, assignee_id=user.id,
            room_id=room_id, title=title, description=description,
            status=staff.TaskStatus.ASSIGNED,
            priority=staff.TaskPriority.HIGH if position % 7 == 0 else staff.TaskPriority.NORMAL,
            source=staff.TaskSource.MANUAL,
            due_at=now + timedelta(hours=2 + position % 5),
            meta={"kind": "demo_staff_assignment", "department": department},
        ))
        counts["tasks_added"] += 1
    return counts
