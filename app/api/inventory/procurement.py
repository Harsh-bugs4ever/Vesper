"""Department requisitions and period budget accounting.

All money is in the property's currency. The budget row serializes changes that
affect available funds; PO ownership and unit costs are snapshots at approval.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from vesper_common.clock import local_today, utcnow
from vesper_common.errors import Conflict, Forbidden, Invalid, NotFound
from vesper_common.permissions import Role

from app.api.identity.models import User, UserAssignment
from app.api.property.models import Department, Property

from .models import (
    DepartmentBudget, InventoryRequest, InventoryRequestAudit, InventoryRequestLine,
    PurchaseOrder, PurchaseStatus, StockItem,
)

CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def budget_totals(db: Session, budget: DepartmentBudget) -> dict[str, Decimal]:
    orders = db.scalars(select(PurchaseOrder).where(PurchaseOrder.budget_id == budget.id)).all()
    committed = Decimal("0")
    spent = Decimal("0")
    for order in orders:
        received = Decimal(order.received_quantity)
        returned = Decimal(order.returned_quantity)
        spent += money((received - returned) * Decimal(order.unit_cost))
        if order.status in {PurchaseStatus.APPROVED, PurchaseStatus.ORDERED,
                            PurchaseStatus.PARTIALLY_RECEIVED}:
            committed += Decimal(order.total_cost) - money(received * Decimal(order.unit_cost))
    allocated = Decimal(budget.allocated)
    return {"allocated": allocated, "committed": committed, "spent": spent,
            "remaining": allocated - committed - spent}


def budget_view(db: Session, budget: DepartmentBudget) -> dict:
    return {"id": budget.id, "property_id": budget.property_id,
            "department_id": budget.department_id, "period_start": budget.period_start,
            "period_end": budget.period_end, "currency": budget.currency,
            **budget_totals(db, budget)}


def active_budget(db: Session, property_id: UUID, department_id: UUID, currency: str,
                  *, lock: bool = False) -> DepartmentBudget:
    today = local_today()
    query = select(DepartmentBudget).where(
        DepartmentBudget.property_id == property_id,
        DepartmentBudget.department_id == department_id,
        DepartmentBudget.currency == currency,
        DepartmentBudget.period_start <= today,
        DepartmentBudget.period_end >= today,
    )
    if lock:
        query = query.with_for_update()
    budget = db.scalars(query).first()
    if budget is None:
        raise Conflict("No active department budget in the property currency")
    return budget


def create_budget(db: Session, property_id: UUID, data) -> DepartmentBudget:
    prop = db.get(Property, property_id)
    department = db.scalars(select(Department).where(
        Department.id == data.department_id, Department.property_id == property_id
    ).with_for_update()).first()
    if prop is None or department is None or department.property_id != property_id:
        raise NotFound("Department not found at this property")
    if data.currency != prop.currency:
        raise Invalid("Budget currency must match the property currency; conversion is not configured")
    if data.period_end < data.period_start:
        raise Invalid("Budget period ends before it starts")
    overlap = db.scalars(select(DepartmentBudget).where(
        DepartmentBudget.property_id == property_id,
        DepartmentBudget.department_id == data.department_id,
        DepartmentBudget.currency == data.currency,
        DepartmentBudget.period_start <= data.period_end,
        DepartmentBudget.period_end >= data.period_start,
    )).first()
    if overlap:
        raise Conflict("Budget period overlaps an existing allocation")
    row = DepartmentBudget(property_id=property_id, **data.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def change_allocation(db: Session, property_id: UUID, budget_id: UUID, allocated: Decimal) -> DepartmentBudget:
    budget = db.scalars(select(DepartmentBudget).where(
        DepartmentBudget.id == budget_id, DepartmentBudget.property_id == property_id
    ).with_for_update()).first()
    if budget is None:
        raise NotFound("Budget not found")
    totals = budget_totals(db, budget)
    if allocated < totals["committed"] + totals["spent"]:
        raise Conflict("Allocation cannot fall below committed plus spent")
    budget.allocated = allocated
    db.commit()
    db.refresh(budget)
    return budget


def _manager(db: Session, property_id: UUID, department_id: UUID) -> UUID:
    department = db.get(Department, department_id)
    if department is None or department.property_id != property_id:
        raise NotFound("Department not found at this property")
    candidates = db.scalars(select(User).options(joinedload(User.role))
        .join(UserAssignment, UserAssignment.user_id == User.id)
        .where(UserAssignment.property_id == property_id,
               UserAssignment.department_id == department_id,
               User.is_active.is_(True)).order_by(User.id)).unique().all()
    managers = [user for user in candidates if user.role.key == Role.MANAGER]
    if department.head_user_id:
        head = next((user for user in managers if user.id == department.head_user_id), None)
        if head:
            return head.id
    if managers:
        return managers[0].id
    raise Conflict("Department has no responsible manager")


def get_request(db: Session, property_id: UUID, request_id: UUID, *, lock: bool = False) -> InventoryRequest:
    query = select(InventoryRequest).options(
        selectinload(InventoryRequest.lines), selectinload(InventoryRequest.history)
    ).where(InventoryRequest.id == request_id, InventoryRequest.property_id == property_id)
    if lock:
        query = query.with_for_update()
    row = db.scalars(query).first()
    if row is None:
        raise NotFound("Inventory request not found")
    return row


def list_requests(db: Session, property_id: UUID, *, requester_id: UUID | None = None,
                  department_id: UUID | None = None) -> list[InventoryRequest]:
    query = select(InventoryRequest).options(
        selectinload(InventoryRequest.lines), selectinload(InventoryRequest.history)
    ).where(InventoryRequest.property_id == property_id)
    if requester_id:
        query = query.where(InventoryRequest.requested_by == requester_id)
    if department_id:
        query = query.where(InventoryRequest.department_id == department_id)
    return list(db.scalars(query.order_by(InventoryRequest.created_at.desc())))


def create_request(db: Session, property_id: UUID, department_id: UUID,
                   requester_id: UUID, data) -> InventoryRequest:
    prop = db.get(Property, property_id)
    if prop is None:
        raise NotFound("Property not found")
    manager_id = _manager(db, property_id, department_id)
    item_ids = [line.item_id for line in data.items]
    if len(set(item_ids)) != len(item_ids):
        raise Invalid("Combine duplicate stock items into one line")
    items = {item.id: item for item in db.scalars(select(StockItem).where(
        StockItem.property_id == property_id, StockItem.id.in_(item_ids),
        StockItem.is_active.is_(True)
    ))}
    if len(items) != len(item_ids):
        raise NotFound("A requested stock item is unavailable at this property")
    row = InventoryRequest(property_id=property_id, department_id=department_id,
        requested_by=requester_id, responsible_manager_id=manager_id,
        currency=prop.currency, reason=data.reason)
    db.add(row)
    db.flush()
    for line in data.items:
        db.add(InventoryRequestLine(request_id=row.id, item_id=line.item_id,
            quantity=line.quantity, unit_cost=items[line.item_id].unit_cost, reason=line.reason))
    db.add(InventoryRequestAudit(request_id=row.id, actor_id=requester_id,
        action="submitted", reason=data.reason, created_at=utcnow()))
    db.commit()
    return get_request(db, property_id, row.id)


def decide_request(db: Session, property_id: UUID, request_id: UUID,
                   manager_id: UUID, *, approve: bool, reason: str) -> InventoryRequest:
    row = get_request(db, property_id, request_id, lock=True)
    if row.responsible_manager_id != manager_id:
        raise Forbidden("Only the responsible department manager may decide this request")
    target = "approved" if approve else "rejected"
    if row.status == target and row.decided_by == manager_id:
        return row  # retry of the same decision; no second PO or audit event
    if row.status != "submitted":
        raise Conflict(f"Request is already {row.status}")
    if approve:
        budget = active_budget(db, property_id, row.department_id, row.currency, lock=True)
        estimate = sum((money(Decimal(line.quantity) * Decimal(line.unit_cost)) for line in row.lines),
                       Decimal("0"))
        if estimate > budget_totals(db, budget)["remaining"]:
            raise Conflict("Department budget has insufficient remaining funds")
        for line in row.lines:
            db.add(PurchaseOrder(property_id=property_id, department_id=row.department_id,
                budget_id=budget.id, request_line_id=line.id, currency=row.currency,
                item_id=line.item_id, quantity=line.quantity, unit_cost=line.unit_cost,
                total_cost=money(Decimal(line.quantity) * Decimal(line.unit_cost)),
                status=PurchaseStatus.APPROVED,
                rationale={"request_id": str(row.id), "line_reason": line.reason},
                approved_by=manager_id, approved_at=utcnow()))
    row.status = target
    row.decided_by = manager_id
    row.decided_at = utcnow()
    row.decision_reason = reason
    db.add(InventoryRequestAudit(request_id=row.id, actor_id=manager_id,
        action=target, reason=reason, created_at=utcnow()))
    db.commit()
    return get_request(db, property_id, row.id)


def cancel_request(db: Session, property_id: UUID, request_id: UUID, requester_id: UUID,
                   reason: str) -> InventoryRequest:
    row = get_request(db, property_id, request_id, lock=True)
    if row.requested_by != requester_id:
        raise Forbidden("Only the requester may cancel a pending request")
    if row.status == "cancelled":
        return row
    if row.status != "submitted":
        raise Conflict("Only a pending request can be cancelled")
    row.status = "cancelled"
    db.add(InventoryRequestAudit(request_id=row.id, actor_id=requester_id,
        action="cancelled", reason=reason, created_at=utcnow()))
    db.commit()
    return get_request(db, property_id, row.id)
