"""Add connected, fictional guest-to-staff-to-manager stories to the demo resort.

Run after scripts/seed.py. Preview is read-only; --apply writes once. No reset or
deletion is performed. Rows have stable IDs, so a second run reports them as existing.

  python scripts/seed_workflow.py --list-properties
  python scripts/seed_workflow.py --property-id UUID
  python scripts/seed_workflow.py --property-id UUID --apply
"""
from __future__ import annotations

import argparse
import importlib
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
    # seed.py loads models under vesper_models to avoid starting the FastAPI app.
    # Reimporting them as app.api.* would register every table twice in one MetaData.
    prefix = "vesper_models" if "vesper_models.property" in sys.modules else "app.api"
    models = {name: importlib.import_module(
        f"{prefix}.{name}" if prefix == "vesper_models" else f"{prefix}.{name}.models"
    ) for name in ("action", "frontdesk", "guest", "guest_intel", "identity",
                   "inventory", "maintenance", "property", "staff", "workforce")}
    action = models["action"]
    frontdesk = models["frontdesk"]
    guest = models["guest"]
    guest_intel = models["guest_intel"]
    identity = models["identity"]
    inventory = models["inventory"]
    maintenance = models["maintenance"]
    prop = models["property"]
    staff = models["staff"]
    workforce = models["workforce"]

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
    required_users = {"gm@vesper.demo", "fom@vesper.demo", "exec@vesper.demo", "chef@vesper.demo", "hk1@vesper.demo", "chiefeng@vesper.demo", "store@vesper.demo", "fnb1@vesper.demo", "front_office1@vesper.demo"}
    if required_departments - departments.keys() or required_users - users.keys():
        raise ValueError("Demo property is missing required departments or role accounts")
    stays = list(db.scalars(select(frontdesk.Stay).where(
        frontdesk.Stay.property_id == property_id,
        frontdesk.Stay.status == frontdesk.StayStatus.IN_HOUSE,
    ).order_by(frontdesk.Stay.room_number).limit(3)))
    if len(stays) < 3:
        raise ValueError("Seed at least three in-house stays before adding workflow scenarios")
    stock_items = {item.sku: item for item in db.scalars(select(inventory.StockItem).where(
        inventory.StockItem.property_id == property_id))}
    required_stock = {"LN-TOWEL", "TL-DENTAL", "FD-EGGS", "FD-BREAD", "SP-AC", "TL-SOAP", "TL-SHAMPOO"}
    if required_stock - stock_items.keys():
        raise ValueError("Demo property is missing stock items needed for staff requisitions")
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

    def add_related(model, key: str, **fields):
        """Add a dependent row that has no property_id column."""
        row_id = scenario_id(property_id, key)
        if db.get(model, row_id) is not None:
            existing.append(key)
            return row_id
        added.append(key)
        if apply:
            db.add(model(id=row_id, **fields))
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

    # Claimable work and active assignments across staff departments. These are
    # internal tasks, so they do not claim a guest request changed status.
    add(staff.Task, "task:linen-pool", department_id=dept["housekeeping"].id,
        room_id=stays[0].room_id, title=f"Deliver fresh linen to room {stays[0].room_number}",
        description="Collect clean linen and confirm delivery with the room.",
        status=staff.TaskStatus.OPEN, priority=staff.TaskPriority.HIGH,
        source=staff.TaskSource.MANUAL, due_at=now + timedelta(minutes=25))
    add(staff.Task, "task:fnb-pool", department_id=dept["fnb"].id,
        room_id=stays[1].room_id, title=f"Refresh minibar in room {stays[1].room_number}",
        description="Check the minibar inventory and replace consumed items.",
        status=staff.TaskStatus.OPEN, priority=staff.TaskPriority.NORMAL,
        source=staff.TaskSource.MANUAL, due_at=now + timedelta(minutes=50))
    add(staff.Task, "task:fnb-active", department_id=dept["fnb"].id,
        assignee_id=users["fnb1@vesper.demo"].id, title="Prepare afternoon service station",
        description="Set up clean serviceware and confirm supplies for the afternoon shift.",
        status=staff.TaskStatus.IN_PROGRESS, priority=staff.TaskPriority.NORMAL,
        source=staff.TaskSource.MANUAL, accepted_at=now - timedelta(minutes=10),
        due_at=now + timedelta(minutes=40))
    add(staff.Task, "task:engineering-pool", department_id=dept["maintenance"].id,
        title="Inspect service lift indicator", description="Check the indicator and report any defect.",
        status=staff.TaskStatus.OPEN, priority=staff.TaskPriority.HIGH,
        source=staff.TaskSource.MANUAL, due_at=now + timedelta(minutes=35))
    add(staff.Task, "task:front-office-pool", department_id=dept["front_office"].id,
        title="Prepare arrival handover", description="Review expected arrivals with the next shift.",
        status=staff.TaskStatus.OPEN, priority=staff.TaskPriority.NORMAL,
        source=staff.TaskSource.MANUAL, due_at=now + timedelta(minutes=90))
    add(staff.Task, "task:store-assigned", department_id=dept["store"].id,
        assignee_id=users["store@vesper.demo"].id, title="Count linen shelf stock",
        description="Count towels and sheets, then report any discrepancy to the store lead.",
        status=staff.TaskStatus.ASSIGNED, priority=staff.TaskPriority.NORMAL,
        source=staff.TaskSource.MANUAL, due_at=now + timedelta(hours=2))

    # Each demo staff department has a task that can exercise photo evidence and AI
    # completion. The housekeeping task also exposes one safe sample photo in the UI.
    evidence_tasks = [
        ("housekeeping", "hk1@vesper.demo", "Restock linen and guest amenities in the room",
         "Make the bed neatly and place fresh towels and guest toiletries.",
         {"demo_image_url": "/demo/task-completion-housekeeping.png"}),
        ("fnb", "fnb1@vesper.demo", "Set up the breakfast service station",
         "Arrange clean serviceware and prepare the station for the next service." , {}),
        ("maintenance", "chiefeng@vesper.demo", "Repair the room corridor wall light",
         "Replace the damaged light cover and leave the fitting secure." , {}),
        ("front_office", "front_office1@vesper.demo", "Prepare guest welcome packs",
         "Set out complete welcome amenities for the next arrivals." , {}),
        ("store", "store@vesper.demo", "Restock the linen dispatch shelf",
         "Arrange clean towel bundles so the next shift can issue them quickly." , {}),
        ("security", "security@vesper.demo", "Complete the lobby safety walkthrough",
         "Check that guest routes and emergency exits are clear." , {}),
    ]
    for department_key, email, title, description, task_meta in evidence_tasks:
        add(staff.Task, f"task:evidence:{department_key}",
            department_id=dept[department_key].id, assignee_id=users[email].id,
            title=title, description=description,
            status=staff.TaskStatus.ASSIGNED, priority=staff.TaskPriority.NORMAL,
            source=staff.TaskSource.MANUAL, due_at=now + timedelta(hours=3), meta=task_meta)
    for department_key, title in [
        ("store", "Prepare the linen issue trolley for the next shift"),
        ("security", "Check the staff entrance access log"),
    ]:
        add(staff.Task, f"task:evidence-next:{department_key}",
            department_id=dept[department_key].id, title=title,
            description="Complete the assigned department task and attach a photo for verification.",
            status=staff.TaskStatus.OPEN, priority=staff.TaskPriority.NORMAL,
            source=staff.TaskSource.MANUAL, due_at=now + timedelta(hours=5))

    # Ensure every named demo staff account (including the full generated team)
    # has an individual task on their own dashboard, not only the six showcase logins.
    department_work = {
        "housekeeping": ("Refresh a guest room", "Reset the room, replace used linen, and confirm amenities are ready."),
        "fnb": ("Prepare a service station", "Set out clean serviceware and confirm the station is ready for service."),
        "front_office": ("Prepare an arrival handover", "Review arrivals and leave clear notes for the next front desk shift."),
        "maintenance": ("Complete a property safety check", "Inspect your assigned work area and report any repair that needs follow-up."),
        "store": ("Check a stock shelf", "Confirm the shelf count and report any item below its minimum quantity."),
        "security": ("Walk the guest areas", "Check that guest routes and emergency exits are clear."),
    }
    department_by_id = {department.id: key for key, department in dept.items()}
    for user in users.values():
        department_key = department_by_id.get(user.department_id)
        if user.role.key != "staff" or department_key not in department_work:
            continue
        title, description = department_work[department_key]
        add(staff.Task, f"task:individual:{user.email}",
            department_id=dept[department_key].id, assignee_id=user.id,
            title=title, description=description,
            status=staff.TaskStatus.ASSIGNED, priority=staff.TaskPriority.NORMAL,
            source=staff.TaskSource.MANUAL, due_at=now + timedelta(days=1))

    # Story 4: a low stock special is visible in the guest menu and in procurement.
    # Existing stock is never edited; its on-hand quantity and ledger stay consistent.
    stock_id = add(inventory.StockItem, "stock:special", department_id=dept["store"].id,
        sku="DEMO-SAFFRON", name="Demo Saffron Mix", category="food", unit="pack",
        quantity=Decimal("0"), minimum_quantity=Decimal("4"),
        reorder_quantity=Decimal("12"), unit_cost=Decimal("480"),
        supplier="Demo Kitchen Supplier", lead_time_days=2)
    # Give every department its own stock catalog so staff and managers see a
    # useful, correctly scoped inventory view instead of an empty store-only list.
    department_stock = {
        "housekeeping": [
            ("HK-LINEN-KIT", "Housekeeping linen bundle", "linen", "bundle", "18", "12", "30", "950", "Linen Mills"),
            ("HK-SOAP-CASE", "Guest soap case", "toiletries", "case", "4", "6", "12", "540", "Amenity Co"),
        ],
        "fnb": [
            ("FNB-EGGS-TRAY", "Breakfast eggs", "food", "tray", "18", "12", "30", "210", "Juhu Poultry"),
            ("FNB-TEA-TIN", "Restaurant tea leaves", "beverage", "kg", "3", "6", "15", "890", "Assam Direct"),
        ],
        "front_office": [
            ("FO-WELCOME-KIT", "Guest welcome amenity kit", "toiletries", "kit", "24", "12", "36", "180", "Amenity Co"),
            ("FO-KEY-SLEEVE", "Room key card sleeves", "cleaning", "pack", "16", "8", "24", "95", "PrintWorks Mumbai"),
        ],
        "maintenance": [
            ("MT-AC-FILTER", "Room AC replacement filter", "spare_parts", "piece", "2", "4", "10", "850", "CoolTech"),
            ("MT-LED-BULB", "Warm LED replacement bulb", "spare_parts", "piece", "28", "12", "36", "120", "Elektra"),
        ],
        "store": [
            ("ST-CLEANER", "Multi-surface cleaner", "cleaning", "bottle", "42", "18", "48", "190", "CleanPro"),
            ("ST-TORCH-BATTERY", "Inspection torch batteries", "spare_parts", "pair", "14", "8", "24", "110", "Elektra"),
        ],
        "security": [
            ("SEC-TORCH-BATTERY", "Security torch batteries", "spare_parts", "pair", "2", "6", "18", "110", "Elektra"),
            ("SEC-GLOVES", "Safety gloves", "cleaning", "pair", "22", "10", "30", "75", "SafeHands"),
        ],
    }
    requisition_stock = {sku: (item.id, item.unit_cost) for sku, item in stock_items.items()}
    requisition_stock["DEMO-SAFFRON"] = (stock_id, Decimal("480"))
    for department_key, rows in department_stock.items():
        for sku, name, category, unit, quantity, minimum, reorder, cost, supplier in rows:
            item_id = add(inventory.StockItem, f"stock:department:{sku.lower()}",
                department_id=dept[department_key].id, sku=sku, name=name,
                category=category, unit=unit, quantity=Decimal(quantity),
                minimum_quantity=Decimal(minimum), reorder_quantity=Decimal(reorder),
                unit_cost=Decimal(cost), supplier=supplier, lead_time_days=2)
            requisition_stock[sku] = (item_id, Decimal(cost))
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

    # Department dashboards display read-only stock requests created by the
    # replenishment workflow; the requests are not waiting on a manager action.
    def staff_requisition(key: str, department: str, requester: str, reason: str,
                          lines: list[tuple[str, str, str]]) -> None:
        requester_id = users[requester].id
        request_id = add(inventory.InventoryRequest, f"requisition:{key}",
            department_id=dept[department].id, requested_by=requester_id,
            responsible_manager_id=dept[department].head_user_id or gm.id,
            currency=resort.currency, status="submitted", reason=reason)
        for sku, quantity, line_reason in lines:
            item_id, unit_cost = requisition_stock[sku]
            add_related(inventory.InventoryRequestLine, f"requisition-line:{key}:{sku}",
                request_id=request_id, item_id=item_id, quantity=Decimal(quantity),
                unit_cost=unit_cost, reason=line_reason)
        add_related(inventory.InventoryRequestAudit, f"requisition-audit:{key}",
            request_id=request_id, actor_id=requester_id, action="submitted",
            reason=reason, created_at=now)

    staff_requisition("housekeeping", "housekeeping", "hk1@vesper.demo",
        "Replenish linen and guest amenity carts for the next shift.", [
            ("HK-LINEN-KIT", "12", "Replace linen bundles used by occupied rooms."),
            ("HK-SOAP-CASE", "6", "Refill guest amenity carts."),
        ])
    staff_requisition("fnb", "fnb", "fnb1@vesper.demo",
        "Replenish breakfast station supplies.", [
            ("FNB-EGGS-TRAY", "6", "Cover the next breakfast service."),
            ("FNB-TEA-TIN", "8", "Cover the next restaurant service."),
        ])
    staff_requisition("maintenance", "maintenance", "chiefeng@vesper.demo",
        "Keep replacement filters available for room AC work.", [
            ("MT-AC-FILTER", "4", "Keep replacement filters available for room AC work."),
        ])
    staff_requisition("front-office", "front_office", "front_office1@vesper.demo",
        "Prepare guest amenity packs for the upcoming arrivals.", [
            ("FO-WELCOME-KIT", "24", "Prepare amenity kits for expected check-ins."),
            ("FO-KEY-SLEEVE", "8", "Keep arrival key sleeves available."),
        ])
    staff_requisition("store", "store", "store@vesper.demo",
        "Replenish shared cleaning and inspection supplies.", [
            ("ST-CLEANER", "18", "Refill the common supply shelves."),
            ("ST-TORCH-BATTERY", "8", "Keep inspection batteries available."),
        ])
    staff_requisition("security", "security", "security@vesper.demo",
        "Replenish safety walkthrough supplies.", [
            ("SEC-TORCH-BATTERY", "12", "Keep patrol torches ready for each shift."),
            ("SEC-GLOVES", "10", "Restock safety gloves for the team."),
        ])

    # Staff absence creates a visible staffing constraint without publishing a roster.
    next_week = today + timedelta(days=7 - today.weekday())
    add(workforce.LeaveRequest, f"leave:housekeeping:{next_week.isoformat()}", user_id=hk.id,
        from_date=next_week, to_date=next_week + timedelta(days=1),
        reason="Demo approved leave for staffing coverage review",
        status=workforce.LeaveStatus.APPROVED, decided_by=gm.id,
        decided_at=now - timedelta(days=1))
    add(workforce.Roster, f"roster:housekeeping:{next_week.isoformat()}", department_id=dept["housekeeping"].id,
        week_start=next_week, status=workforce.RosterStatus.DRAFT,
        method="greedy", objective="coverage",
        gaps=[{"date": next_week.isoformat(), "shift": "morning", "count": 1}],
        notes="Demo draft: review leave and fill one morning coverage gap before publishing.")

    # Give each department's staff view a real, clearly unpublished example schedule.
    # These are review drafts for the upcoming week; staff are told to follow only a
    # manager-published roster. The housekeeping draft above retains its leave gap.
    roster_week = next_week
    shift_keys = ("morning", "evening", "night")
    for department_key, department in dept.items():
        if department_key == "housekeeping":
            roster_id = scenario_id(property_id, f"roster:housekeeping:{roster_week.isoformat()}")
        else:
            roster_id = add(workforce.Roster, f"roster:staff-demo:{department_key}:{roster_week.isoformat()}",
                department_id=department.id, week_start=roster_week,
                status=workforce.RosterStatus.DRAFT, method="greedy", objective="coverage",
                gaps=[], notes="Demo schedule draft: review assignments before publishing.")
        members = sorted(
            (user for user in users.values()
             if user.department_id == department.id and user.role.key == "staff"),
            key=lambda user: user.email,
        )
        for member_index, member in enumerate(members):
            for day_offset in range(7):
                work_date = roster_week + timedelta(days=day_offset)
                if (department_key == "housekeeping" and member.email == "hk1@vesper.demo"
                        and work_date <= roster_week + timedelta(days=1)):
                    continue  # Respect the seeded leave request and preserve the coverage gap.
                add_related(workforce.RosterEntry,
                    f"roster-entry:staff-demo:{department_key}:{roster_week.isoformat()}:{member.email}:{work_date.isoformat()}",
                    roster_id=roster_id, property_id=property_id, user_id=member.id,
                    department_id=department.id, work_date=work_date,
                    shift_key=shift_keys[(member_index + day_offset) % len(shift_keys)])

    if apply:
        db.commit()
    return {"property_id": str(property_id), "property": resort.name,
            "created" if apply else "would_create": len(added),
            "already_present": len(existing), "new_keys": added,
            "stories": ["overdue housekeeping", "AC issue to work order",
                        "completed request with feedback", "out of stock menu to procurement",
                        "leave to roster gap", "staff tasks and requisitions"]}


def main() -> int:
    parser = argparse.ArgumentParser(description="Preview or add connected demo workflow scenarios")
    parser.add_argument("--list-properties", action="store_true")
    parser.add_argument("--property-id", type=UUID)
    parser.add_argument("--apply", action="store_true", help="Write the previewed demo scenarios")
    args = parser.parse_args()
    from app.api.property.models import Property
    with session_scope() as db:
        if args.list_properties:
            properties = list(db.scalars(select(Property).order_by(Property.name)))
            if not properties:
                print("No properties found in the configured database. For a local demo, run "
                      "python scripts/seed.py without --reset; if the app already has data, "
                      "check VESPER_DATABASE_URL.")
                return 1
            for row in properties:
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
