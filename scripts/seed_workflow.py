"""Add connected, fictional guest-to-staff-to-manager stories to the demo resort.

Run after scripts/seed.py. Preview is read-only; --apply writes once. No reset or
deletion is performed. Rows have stable IDs, so a second run reports them as existing.

  python scripts/seed_workflow.py --list-properties
  python scripts/seed_workflow.py --property-id UUID
  python scripts/seed_workflow.py --property-id UUID --apply
"""
from __future__ import annotations

import argparse
import sys
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from uuid import NAMESPACE_URL, UUID, uuid5
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "packages" / "py-common"))

from sqlalchemy import select  # noqa: E402
from vesper_common.clock import utcnow  # noqa: E402
from vesper_common.db import session_scope  # noqa: E402


def scenario_id(property_id: UUID, key: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"vesper:workflow-demo:v1:{property_id}:{key}")


def seed_workflow(db, property_id: UUID, *, apply: bool = False) -> dict[str, object]:
    """Plan or add connected scenarios. Only the original synthetic property qualifies."""
    from app.api.action import models as action
    from app.api.frontdesk import models as frontdesk
    from app.api.guest import models as guest
    from app.api.guest_intel import models as guest_intel
    from app.api.identity import models as identity
    from app.api.inventory import models as inventory
    from app.api.maintenance import models as maintenance
    from app.api.property import models as prop
    from app.api.staff import models as staff
    from app.api.workforce import models as workforce

    resort = db.get(prop.Property, property_id)
    if resort is None:
        raise ValueError("Property not found")
    demo_account = db.scalar(select(identity.User.id).where(
        identity.User.property_id == property_id,
        identity.User.email == "gm@vesper.demo",
    ))
    if resort.name != "JW Marriott Mumbai, Juhu" or demo_account is None:
        raise ValueError("Workflow scenarios are restricted to the synthetic resort from scripts/seed.py")

    departments = {d.key: d for d in db.scalars(select(prop.Department).where(prop.Department.property_id == property_id))}
    users = {u.email: u for u in db.scalars(select(identity.User).where(identity.User.property_id == property_id))}
    required_departments = {"front_office", "housekeeping", "fnb", "maintenance", "store"}
    required_users = {"gm@vesper.demo", "fom@vesper.demo", "exec@vesper.demo", "chef@vesper.demo", "hk1@vesper.demo", "chiefeng@vesper.demo", "store@vesper.demo"}
    if required_departments - departments.keys() or required_users - users.keys():
        raise ValueError("Demo property is missing required departments or role accounts")
    stays = list(db.scalars(select(frontdesk.Stay).where(
        frontdesk.Stay.property_id == property_id,
        frontdesk.Stay.status == frontdesk.StayStatus.IN_HOUSE,
    ).order_by(frontdesk.Stay.room_number).limit(3)))
    if len(stays) < 3:
        raise ValueError("Seed at least three in-house stays before adding workflow scenarios")
    now = utcnow()
    today = now.astimezone(ZoneInfo(resort.timezone)).date()
    gm = users["gm@vesper.demo"]
    hk = users["hk1@vesper.demo"]
    engineer = users["chiefeng@vesper.demo"]
    chef = users["chef@vesper.demo"]
    dept = departments
    added: list[str] = []
    existing: list[str] = []

    def add(model, key: str, **fields):
        row_id = scenario_id(property_id, key)
        if db.get(model, row_id) is not None:
            existing.append(key)
            return row_id
        added.append(key)
        if apply:
            db.add(model(id=row_id, property_id=property_id, **fields))
            # Several cross-context references are plain UUIDs. Flush in story order
            # so rows with real foreign keys (such as a PO's stock item) exist first.
            db.flush()
        return row_id

    # Story 1: an overdue guest request remains visible to the guest, a housekeeper,
    # and the manager. The source_ref is the same request ID the guest tracks.
    stay = stays[0]
    request_id = add(guest.ServiceRequest, "guest:housekeeping", stay_id=stay.id,
        room_id=stay.room_id, room_number=stay.room_number, guest_id=stay.guest_id,
        department_id=dept["housekeeping"].id, kind=guest.RequestKind.HOUSEKEEPING,
        status=guest.RequestStatus.RAISED,
        note="Demo: extra towels requested; awaiting acknowledgement",
        sla_minutes=20, due_at=now - timedelta(minutes=12))
    add(staff.Task, "task:housekeeping", department_id=dept["housekeeping"].id,
        assignee_id=hk.id, room_id=stay.room_id, title=f"Deliver towels to room {stay.room_number}",
        description="Guest request is overdue. Confirm delivery with the guest.",
        status=staff.TaskStatus.ASSIGNED, priority=staff.TaskPriority.HIGH,
        source=staff.TaskSource.GUEST_REQUEST, source_ref=request_id,
        due_at=now - timedelta(minutes=12))

    # Story 2: a broken AC creates one issue, one work order, and one staff task.
    stay = stays[1]
    issue_id = scenario_id(property_id, "issue:ac")
    order_id = scenario_id(property_id, "workorder:ac")
    maintenance_request = add(guest.ServiceRequest, "guest:maintenance", stay_id=stay.id,
        room_id=stay.room_id, room_number=stay.room_number, guest_id=stay.guest_id,
        department_id=dept["maintenance"].id, kind=guest.RequestKind.MAINTENANCE,
        status=guest.RequestStatus.ACCEPTED,
        note="Demo: AC cooling weak; engineer assigned", sla_minutes=45,
        due_at=now + timedelta(minutes=35), accepted_at=now - timedelta(minutes=10),
        accepted_by=engineer.id)
    task_id = add(staff.Task, "task:ac", department_id=dept["maintenance"].id,
        assignee_id=engineer.id, room_id=stay.room_id,
        title=f"Inspect AC in room {stay.room_number}",
        description="Guest reported weak cooling. Diagnose before deciding if a room move is needed.",
        status=staff.TaskStatus.ASSIGNED, priority=staff.TaskPriority.HIGH,
        source=staff.TaskSource.GUEST_REQUEST, source_ref=maintenance_request,
        due_at=now + timedelta(minutes=35))
    add(guest.IssueReport, "issue:ac", room_id=stay.room_id, room_number=stay.room_number,
        department_id=dept["maintenance"].id, reporter_department_id=dept["front_office"].id,
        responsible_manager_id=dept["maintenance"].head_user_id,
        work_order_id=order_id, reported_by_guest=True,
        summary=f"AC cooling weak in room {stay.room_number}",
        description="Demo guest reported weak cooling. Engineering should inspect before any room status change.",
        category="air_conditioning", severity="high", status=guest.IssueStatus.SCHEDULED)
    add(maintenance.WorkOrder, "workorder:ac", room_id=stay.room_id,
        source_issue_id=issue_id, task_id=task_id, department_id=dept["maintenance"].id,
        title=f"Inspect AC in room {stay.room_number}",
        description="Linked to a guest issue and engineering task; room remains occupied until inspected.",
        kind=maintenance.WorkOrderKind.CORRECTIVE,
        status=maintenance.WorkOrderStatus.OPEN, priority="high",
        scheduled_for=today, estimated_cost=Decimal("1800"))

    # Story 3: a completed request with feedback gives the manager an actual outcome.
    stay = stays[2]
    completed_request = add(guest.ServiceRequest, "guest:amenities-done", stay_id=stay.id,
        room_id=stay.room_id, room_number=stay.room_number, guest_id=stay.guest_id,
        department_id=dept["housekeeping"].id, kind=guest.RequestKind.AMENITIES,
        status=guest.RequestStatus.DELIVERED, note="Demo: dental kit delivered",
        sla_minutes=30, due_at=now - timedelta(hours=1),
        accepted_at=now - timedelta(hours=2), accepted_by=hk.id,
        delivered_at=now - timedelta(minutes=75), rating=5,
        rating_comment="Quick and thoughtful service", rated_at=now - timedelta(hours=1))
    add(staff.Task, "task:amenities-done", department_id=dept["housekeeping"].id,
        assignee_id=hk.id, room_id=stay.room_id, title=f"Deliver dental kit to room {stay.room_number}",
        status=staff.TaskStatus.DONE, priority=staff.TaskPriority.NORMAL,
        source=staff.TaskSource.GUEST_REQUEST, source_ref=completed_request,
        due_at=now - timedelta(hours=1), completed_at=now - timedelta(minutes=75),
        completed_by=hk.id)
    add(guest_intel.SentimentRecord, "sentiment:amenities-done", guest_id=stay.guest_id,
        request_id=completed_request, department_id=dept["housekeeping"].id,
        comment="Quick and thoughtful service", rating=5, score=0.9,
        label="positive", confidence=1.0, method="rating_only",
        themes=["service"], occurred_on=today)

    # Story 4: a low stock special is visible in the guest menu and in procurement.
    # Existing stock is never edited; its on-hand quantity and ledger stay consistent.
    stock_id = add(inventory.StockItem, "stock:special", department_id=dept["store"].id,
        sku="DEMO-SAFFRON", name="Demo Saffron Mix", category="food", unit="pack",
        quantity=Decimal("0"), minimum_quantity=Decimal("4"),
        reorder_quantity=Decimal("12"), unit_cost=Decimal("480"),
        supplier="Demo Kitchen Supplier", lead_time_days=2)
    add(guest.MenuItem, "menu:special", category="Dessert", name="Demo Saffron Dessert",
        description="Demo special; currently unavailable while the ingredient is replenished.",
        price=Decimal("690"), is_veg=True, prep_minutes=15,
        is_available=True, recipe={str(stock_id): 1})
    month_start = today.replace(day=1)
    next_month = (month_start + timedelta(days=32)).replace(day=1)
    budget_key = f"budget:fnb:{month_start}"
    budget_id = scenario_id(property_id, budget_key)
    existing_budget = db.scalar(select(inventory.DepartmentBudget).where(
        inventory.DepartmentBudget.property_id == property_id,
        inventory.DepartmentBudget.department_id == dept["fnb"].id,
        inventory.DepartmentBudget.period_start == month_start,
        inventory.DepartmentBudget.period_end == next_month - timedelta(days=1),
        inventory.DepartmentBudget.currency == resort.currency,
    ))
    if existing_budget is not None and existing_budget.id != budget_id:
        budget_id = existing_budget.id
        existing.append("existing:fnb-budget")
    else:
        add(inventory.DepartmentBudget, budget_key,
            department_id=dept["fnb"].id, period_start=month_start,
            period_end=next_month - timedelta(days=1), currency=resort.currency,
            allocated=Decimal("150000"))
    request_id = add(inventory.InventoryRequest, "inventory-request:special",
        department_id=dept["fnb"].id, requested_by=chef.id,
        responsible_manager_id=chef.id, currency=resort.currency, status="submitted",
        reason="Demo special is unavailable because its ingredient is out of stock.")
    line_id = scenario_id(property_id, "inventory-line:special")
    if db.get(inventory.InventoryRequestLine, line_id) is None:
        added.append("inventory-line:special")
        if apply:
            db.add(inventory.InventoryRequestLine(id=line_id, request_id=request_id,
                item_id=stock_id, quantity=Decimal("12"), unit_cost=Decimal("480"),
                reason="Restore the demo dessert after manager approval."))
    else:
        existing.append("inventory-line:special")
    add(inventory.PurchaseOrder, "purchase-order:special", department_id=dept["fnb"].id,
        budget_id=budget_id, item_id=stock_id, currency=resort.currency,
        quantity=Decimal("12"), unit_cost=Decimal("480"), total_cost=Decimal("5760"),
        supplier="Demo Kitchen Supplier", status=inventory.PurchaseStatus.SUGGESTED,
        expected_on=today + timedelta(days=2),
        rationale={"source": "demo_workflow", "reason": "Ingredient is out of stock; human approval required"})
    add(action.ActionCard, "card:purchase-special", engine="inventory",
        kind=action.CardKind.PURCHASE, status=action.CardStatus.PENDING,
        title="Reorder Demo Saffron Mix",
        summary="Demo special is unavailable: 0 packs on hand against a minimum of 4. Review the proposed purchase before approving.",
        drivers=[{"label": "Below minimum", "detail": "0 on hand against a minimum of 4", "weight": 0.6},
                 {"label": "Lead time", "detail": "2 days from order to delivery", "weight": 0.25},
                 {"label": "Cost", "detail": "Estimated ₹5,760 for 12 packs", "weight": 0.15}],
        confidence=0.9, impact_amount=Decimal("5760"), urgency=action.Urgency.HIGH,
        score=0.23, required_permission="purchase:approve",
        payload={"purchase_order_id": str(scenario_id(property_id, "purchase-order:special")),
                 "item_id": str(stock_id), "quantity": 12, "editable_fields": ["quantity"]},
        dedupe_key=f"purchase:{stock_id}", expires_at=now + timedelta(days=3))

    # Staff absence creates a visible staffing constraint without publishing a roster.
    next_week = today + timedelta(days=(7 - today.weekday()) % 7)
    add(workforce.LeaveRequest, "leave:housekeeping", user_id=hk.id,
        from_date=next_week, to_date=next_week + timedelta(days=1),
        reason="Demo approved leave for staffing coverage review",
        status=workforce.LeaveStatus.APPROVED, decided_by=gm.id,
        decided_at=now - timedelta(days=1))
    add(workforce.Roster, "roster:housekeeping", department_id=dept["housekeeping"].id,
        week_start=next_week, status=workforce.RosterStatus.DRAFT,
        method="greedy", objective="coverage",
        gaps=[{"date": next_week.isoformat(), "shift": "morning", "count": 1}],
        notes="Demo draft: review leave and fill one morning coverage gap before publishing.")

    if apply:
        db.commit()
    return {"property_id": str(property_id), "property": resort.name,
            "created" if apply else "would_create": len(added),
            "already_present": len(existing), "new_keys": added,
            "stories": ["overdue housekeeping", "AC issue to work order",
                        "completed request with feedback", "out of stock menu to procurement",
                        "leave to roster gap"]}


def main() -> int:
    parser = argparse.ArgumentParser(description="Preview or add connected demo workflow scenarios")
    parser.add_argument("--list-properties", action="store_true")
    parser.add_argument("--property-id", type=UUID)
    parser.add_argument("--apply", action="store_true", help="Write the previewed demo scenarios")
    args = parser.parse_args()
    from app.api.property.models import Property
    with session_scope() as db:
        if args.list_properties:
            for row in db.scalars(select(Property).order_by(Property.name)):
                print(f"{row.id}  {row.name}")
            return 0
        if args.property_id is None:
            parser.error("--property-id is required unless --list-properties is used")
        try:
            result = seed_workflow(db, args.property_id, apply=args.apply)
        except ValueError as exc:
            parser.error(str(exc))
    print("Workflow seed applied:" if args.apply else "Workflow seed preview (no writes):")
    for key, value in result.items():
        print(f"  {key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
