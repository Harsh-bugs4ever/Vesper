"""Seed assigned tasks and claimable work for demo staff.

Run ``python scripts/seed_staff_tasks.py`` after the base demo exists. The command
writes tasks and commits them; rerunning it skips existing tasks.
"""
from __future__ import annotations

import argparse
import sys
from datetime import timedelta
from pathlib import Path
from uuid import NAMESPACE_URL, UUID, uuid5

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py-common"))

from sqlalchemy import select

from vesper_common.clock import utcnow
from vesper_common.db import import_all_models, session_scope


def staff_assignment_id(property_id: UUID, user_id: UUID) -> UUID:
    return uuid5(NAMESPACE_URL, f"vesper:staff-assignment:v1:{property_id}:{user_id}")


def claimable_task_id(property_id: UUID, department: str, slot: int) -> UUID:
    return uuid5(NAMESPACE_URL, f"vesper:claimable-work:v1:{property_id}:{department}:{slot}")


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


def seed_claimable_work(db, property_id: UUID) -> dict[str, int]:
    """Add six unassigned tasks per demo department and enable their demo staff."""
    import vesper_models.identity as identity
    import vesper_models.property as prop
    import vesper_models.staff as staff

    resort = db.get(prop.Property, property_id)
    if resort is None or resort.name != "JW Marriott Mumbai, Juhu":
        raise ValueError("Claimable work is limited to the synthetic demo resort")
    role = db.scalar(select(identity.Role).where(
        identity.Role.property_id == property_id, identity.Role.key == "staff"))
    if role is None:
        raise ValueError("Demo staff role is missing")
    departments = {row.key: row for row in db.scalars(select(prop.Department).where(
        prop.Department.property_id == property_id))}
    users = list(db.scalars(select(identity.User).where(
        identity.User.property_id == property_id,
        identity.User.role_id == role.id,
        identity.User.email.like("%@vesper.demo"))))
    rooms = list(db.scalars(select(prop.Room).where(
        prop.Room.property_id == property_id).order_by(prop.Room.number)))
    if len(rooms) < 6:
        raise ValueError("Demo needs at least six rooms for claimable housekeeping work")

    claimable_departments = ("housekeeping", "fnb", "front_office", "maintenance", "store", "security")
    counts = {"claimable_added": 0, "already_present": 0, "pool_grants_added": 0}
    for key in claimable_departments:
        department = departments.get(key)
        eligible = [user for user in users if department is not None and
                    user.department_id == department.id]
        if not eligible:
            raise ValueError(f"No demo staff can claim {key} tasks")
        for user in eligible:
            grants = set(user.extra_permissions or [])
            if "tasks:pool_read" not in grants:
                user.extra_permissions = sorted(grants | {"tasks:pool_read"})
                counts["pool_grants_added"] += 1

    now = utcnow()
    for key in claimable_departments:
        department = departments[key]
        for slot in range(1, 7):
            task_id = claimable_task_id(property_id, key, slot)
            if db.get(staff.Task, task_id) is not None:
                counts["already_present"] += 1
                continue
            room_id = None
            if key == "housekeeping":
                room = rooms[slot - 1]
                room_id = room.id
                title = f"Replenish room {room.number} amenity cart"
                description = "Check towels and toiletries, then report any missing stock."
            elif key == "fnb":
                title = f"Restock service station {slot}"
                description = "Check beverage, cutlery and service supplies before the next service."
            elif key == "front_office":
                title = f"Prepare arrival desk batch {slot}"
                description = "Review the arrival checklist and flag missing room information."
            elif key == "maintenance":
                title = f"Inspect engineering corridor {slot}"
                description = "Check equipment condition and file a defect report if needed."
            elif key == "store":
                title = f"Count shared stock shelf {slot}"
                description = "Count supplies on the shelf and report any discrepancy."
            else:
                title = f"Inspect security route {slot}"
                description = "Check access points and record any safety concern."
            db.add(staff.Task(
                id=task_id, property_id=property_id, department_id=department.id,
                assignee_id=None, room_id=room_id,
                title=title, description=description,
                status=staff.TaskStatus.OPEN,
                priority=staff.TaskPriority.HIGH if slot in (1, 4) else staff.TaskPriority.NORMAL,
                source=staff.TaskSource.MANUAL,
                due_at=now + timedelta(minutes=30 + slot * 15),
                meta={"kind": "demo_claimable_pool", "department": key},
            ))
            counts["claimable_added"] += 1
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed assigned and claimable demo staff tasks")
    parser.add_argument("--property-id", type=UUID,
                        help="Demo property UUID, needed only if multiple demo properties exist")
    args = parser.parse_args()

    import_all_models(str(REPO_ROOT / "app" / "api"))
    import vesper_models.property as prop

    with session_scope() as db:
        property_id = args.property_id
        if property_id is None:
            matches = list(db.scalars(select(prop.Property.id).where(
                prop.Property.name == "JW Marriott Mumbai, Juhu")))
            if len(matches) != 1:
                parser.error("Expected one demo resort. Run python scripts/seed.py first "
                             "or pass --property-id to choose one.")
            property_id = matches[0]
        try:
            assigned = seed_staff_tasks(db, property_id)
            claimable = seed_claimable_work(db, property_id)
        except ValueError as exc:
            parser.error(str(exc))
        db.commit()

    print(f"Staff tasks saved for property {property_id}:")
    for label, count in {**assigned, **{f"pool_{key}": value for key, value in claimable.items()}}.items():
        print(f"  {label:<17} {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
