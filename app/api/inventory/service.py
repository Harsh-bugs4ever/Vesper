"""Stock ledger, auto-deduction and the reorder rule."""
from __future__ import annotations

import logging
from datetime import timedelta, timezone
from decimal import Decimal
from uuid import UUID, NAMESPACE_URL, uuid5

from sqlalchemy import select
from sqlalchemy.orm import Session

from vesper_common.clock import local_today, utcnow
from vesper_common.errors import Conflict, Invalid, NotFound
from vesper_common.events import Event, bus
from app.api.property.models import Property

from .models import MovementReason, PurchaseOperation, PurchaseOrder, PurchaseStatus, StockItem, StockMovement
from .procurement import active_budget, budget_totals, money
from . import reorder

log = logging.getLogger(__name__)

# Don't re-raise the same low-stock suggestion more than once a day; a store manager who
# has already seen the card does not need it again every time a sandwich goes out.
LOW_FLAG_COOLDOWN_HOURS = 24
EXPIRY_WARNING_DAYS = 7


def get_item(db: Session, property_id: UUID, item_id: UUID) -> StockItem:
    query = select(StockItem).where(StockItem.id == item_id, StockItem.property_id == property_id)
    item = db.scalars(query).first()
    if item is None:
        raise NotFound("Stock item not found")
    return item


def list_items(
    db: Session,
    property_id: UUID,
    *,
    category: str | None = None,
    low_only: bool = False,
    expiring_only: bool = False,
    search: str | None = None,
) -> list[StockItem]:
    query = select(StockItem).where(
        StockItem.property_id == property_id, StockItem.is_active.is_(True)
    )
    if category:
        query = query.where(StockItem.category == category)
    if search:
        needle = f"%{search.lower()}%"
        query = query.where(StockItem.name.ilike(needle) | StockItem.sku.ilike(needle))
    if expiring_only:
        query = query.where(StockItem.expires_on <= local_today() + timedelta(days=EXPIRY_WARNING_DAYS))

    items = list(db.scalars(query.order_by(StockItem.category, StockItem.name)))
    if low_only:
        # Comparing two columns is doable in SQL, but the model already answers this
        # and the store list is a few hundred rows.
        items = [i for i in items if i.is_low]
    return items


def move_stock(
    db: Session,
    property_id: UUID,
    item_id: UUID,
    quantity: Decimal,
    reason: str,
    *,
    actor_id: UUID | None = None,
    note: str | None = None,
    source_ref: UUID | None = None,
    department_id: UUID | None = None,
    commit: bool = True,
) -> StockMovement:
    """Record one in/out movement and recompute the item's balance.

    Negative quantities take stock out. Going below zero is refused rather than clamped:
    a negative balance means the ledger and the shelf already disagree, and hiding that
    makes the next count worse.
    """
    if quantity == 0:
        raise Invalid("A stock movement of zero changes nothing")

    item = db.scalars(select(StockItem).where(
        StockItem.id == item_id, StockItem.property_id == property_id
    ).with_for_update()).first()
    if item is None:
        raise NotFound("Stock item not found")
    new_balance = Decimal(item.quantity) + Decimal(quantity)
    if new_balance < 0:
        raise Conflict(
            "That would take stock below zero",
            details={"on_hand": float(item.quantity), "requested": float(-quantity)},
        )

    item.quantity = new_balance
    movement = StockMovement(
        property_id=property_id,
        department_id=department_id if department_id is not None else item.department_id,
        item_id=item.id,
        quantity=Decimal(quantity),
        reason=reason,
        note=note,
        actor_id=actor_id,
        source_ref=source_ref,
        balance_after=new_balance,
    )
    db.add(movement)
    if not commit:
        db.flush()
        return movement
    db.commit()
    db.refresh(movement)
    db.refresh(item)
    publish_movement(property_id, item, movement, actor_id)
    return movement


def publish_movement(property_id: UUID, item: StockItem, movement: StockMovement,
                     actor_id: UUID | None) -> None:
    bus.publish(
        Event.STOCK_MOVED,
        {
            "item_id": str(item.id),
            "sku": item.sku,
            "name": item.name,
            "quantity": float(movement.quantity),
            "reason": movement.reason,
            "balance": float(movement.balance_after),
        },
        property_id=str(property_id),
        actor_id=str(actor_id) if actor_id else None,
    )


def maybe_flag_low(db: Session, property_id: UUID, item: StockItem) -> PurchaseOrder | None:
    """Serialize reorder decisions on the stock row and reuse suggested POs."""
    item = db.scalars(select(StockItem).where(
        StockItem.id == item.id, StockItem.property_id == property_id,
    ).with_for_update().execution_options(populate_existing=True)).one()
    if not item.is_active:
        return None
    analysis = reorder.analyze(db, item)
    item.average_daily_usage_14d = analysis["average_daily_usage"]
    item.reorder_threshold = analysis["reorder_threshold"]
    item.last_threshold_calculated_at = utcnow()
    if (not analysis["requires_reorder"] or analysis["pending_purchase_order_id"]):
        db.commit()
        return None
    flagged_at = item.low_flagged_at
    if flagged_at and flagged_at.tzinfo is None:
        flagged_at = flagged_at.replace(tzinfo=timezone.utc)
    if flagged_at and utcnow() - flagged_at < timedelta(hours=LOW_FLAG_COOLDOWN_HOURS):
        db.commit()
        return None
    quantity = analysis["recommended_quantity"]
    order = PurchaseOrder(
        property_id=property_id,
        department_id=item.department_id,
        currency=db.get(Property, property_id).currency,
        item_id=item.id,
        quantity=quantity,
        unit_cost=item.unit_cost,
        total_cost=quantity * Decimal(item.unit_cost),
        supplier=item.supplier,
        status=PurchaseStatus.SUGGESTED,
        expected_on=local_today() + timedelta(days=item.lead_time_days),
        rationale=reorder.snapshot(analysis),
        reorder_key=f"{property_id}:{item.id}",
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # action-service picks this up and ranks it into the owner's queue.
    bus.publish(
        Event.STOCK_LOW,
        purchase_event_payload(item, order, analysis),
        property_id=str(property_id),
    )
    return order


def purchase_event_payload(item: StockItem, order: PurchaseOrder, analysis: dict) -> dict:
    return {
        "item_id": str(item.id), "purchase_order_id": str(order.id),
        "sku": item.sku, "name": item.name, "category": item.category,
        "on_hand": float(item.quantity), "minimum": float(analysis["reorder_threshold"]),
        "suggested_quantity": float(order.quantity), "unit": item.unit,
        "estimated_cost": float(order.total_cost), "supplier": item.supplier,
        "lead_time_days": item.lead_time_days, "analysis": reorder.snapshot(analysis),
    }


def close_suggestion(db: Session, property_id: UUID, order_id: UUID, *, reason: str) -> None:
    """Mirror a dismissed action card without creating a competing decision flow."""
    order = _locked_order(db, property_id, order_id)
    if order.status != PurchaseStatus.SUGGESTED or order.reorder_key is None:
        return
    item = db.scalars(select(StockItem).where(StockItem.id == order.item_id,
        StockItem.property_id == property_id).with_for_update()).one()
    order.status = PurchaseStatus.CANCELLED
    order.reorder_key = None
    order.rationale = {**order.rationale, "closed_reason": reason}
    item.low_flagged_at = utcnow()
    db.commit()


def consume_recipe(
    db: Session, property_id: UUID, recipe: dict, *, multiplier: int, source_ref: UUID | None
) -> list[StockMovement]:
    """Deduct one delivered order's ingredients.

    A recipe line that points at an item we no longer stock is logged and skipped — the
    order was already delivered, and refusing to record the rest would lose real data.
    """
    movements: list[StockMovement] = []
    for item_id, per_portion in (recipe or {}).items():
        try:
            movements.append(
                move_stock(
                    db,
                    property_id,
                    UUID(item_id),
                    -Decimal(str(per_portion)) * multiplier,
                    MovementReason.CONSUMPTION,
                    note="Auto-deducted on delivery",
                    source_ref=source_ref,
                )
            )
        except (NotFound, Conflict, Invalid) as exc:
            log.warning("could not deduct %s x%s: %s", item_id, multiplier, exc)
    return movements


def sweep_expiring(db: Session, property_id: UUID) -> list[StockItem]:
    """Runs daily. Anything inside the warning window gets a badge and an event."""
    cutoff = local_today() + timedelta(days=EXPIRY_WARNING_DAYS)
    query = select(StockItem).where(
        StockItem.property_id == property_id,
        StockItem.is_active.is_(True),
        StockItem.expires_on.is_not(None),
        StockItem.expires_on <= cutoff,
        StockItem.quantity > 0,
    )
    items = list(db.scalars(query))
    for item in items:
        bus.publish(
            Event.STOCK_EXPIRING,
            {
                "item_id": str(item.id),
                "name": item.name,
                "quantity": float(item.quantity),
                "expires_on": item.expires_on.isoformat(),
                "days_to_expiry": item.days_to_expiry,
            },
            property_id=str(property_id),
        )
    return items


def item_movements(db: Session, property_id: UUID, item_id: UUID, *, limit: int = 100) -> list[StockMovement]:
    query = (
        select(StockMovement)
        .where(StockMovement.property_id == property_id, StockMovement.item_id == item_id)
        .order_by(StockMovement.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(query))


# --- purchase orders --------------------------------------------------------------


def list_purchase_orders(db: Session, property_id: UUID, *, status: str | None = None) -> list[PurchaseOrder]:
    query = select(PurchaseOrder).where(PurchaseOrder.property_id == property_id)
    if status:
        query = query.where(PurchaseOrder.status == status)
    return list(db.scalars(query.order_by(PurchaseOrder.created_at.desc())))


def get_purchase_order(db: Session, property_id: UUID, order_id: UUID) -> PurchaseOrder:
    query = select(PurchaseOrder).where(
        PurchaseOrder.id == order_id, PurchaseOrder.property_id == property_id
    )
    order = db.scalars(query).first()
    if order is None:
        raise NotFound("Purchase order not found")
    return order


def approve_purchase_order(
    db: Session, property_id: UUID, order_id: UUID, *, actor_id: UUID, quantity: Decimal | None = None
) -> PurchaseOrder:
    """Approve, optionally adjusting the quantity the engine suggested."""
    order = _locked_order(db, property_id, order_id)
    if order.status != PurchaseStatus.SUGGESTED:
        raise Conflict(f"That order is already {order.status}")
    if order.department_id is None:
        raise Conflict("Order has no responsible department")
    budget = active_budget(db, property_id, order.department_id, order.currency, lock=True)
    suggested_quantity = Decimal(order.quantity)
    if quantity is not None:
        if quantity <= 0:
            raise Invalid("Order quantity must be greater than zero")
        order.quantity = quantity
        order.total_cost = money(quantity * Decimal(order.unit_cost))
    order.rationale = {**(order.rationale or {}),
                       "suggested_quantity": str(suggested_quantity),
                       "approved_quantity": str(order.quantity)}
    if order.total_cost > budget_totals(db, budget)["remaining"]:
        raise Conflict("Department budget has insufficient remaining funds")
    order.budget_id = budget.id
    order.status = PurchaseStatus.APPROVED
    order.reorder_key = None
    order.approved_by = actor_id
    order.approved_at = utcnow()
    db.commit()
    db.refresh(order)
    return order


def _locked_order(db: Session, property_id: UUID, order_id: UUID) -> PurchaseOrder:
    # All budget mutations take the budget lock before the PO lock.
    snapshot = get_purchase_order(db, property_id, order_id)
    if snapshot.budget_id is not None:
        from .models import DepartmentBudget
        db.scalars(select(DepartmentBudget).where(
            DepartmentBudget.id == snapshot.budget_id
        ).with_for_update()).first()
    return db.scalars(select(PurchaseOrder).where(
        PurchaseOrder.id == order_id, PurchaseOrder.property_id == property_id
    ).with_for_update().execution_options(populate_existing=True)).first()


def receive_purchase_order(db: Session, property_id: UUID, order_id: UUID, *, actor_id: UUID,
                           quantity: Decimal | None = None, operation_id: UUID | None = None) -> PurchaseOrder:
    """Part receipts are serialized with the PO and stock item in one transaction."""
    order = _locked_order(db, property_id, order_id)
    if quantity is not None and operation_id is None:
        raise Invalid("Partial receipts require an operation_id")
    operation_id = operation_id or uuid5(NAMESPACE_URL, f"vesper:full-receipt:{order_id}")
    existing = db.scalars(select(PurchaseOperation).where(
        PurchaseOperation.order_id == order_id,
        PurchaseOperation.operation_id == operation_id
    )).first()
    if existing:
        if existing.kind != "receipt" or (quantity is not None and existing.quantity != quantity):
            raise Conflict("Operation ID was already used for a different receipt")
        return order
    if order.status not in {PurchaseStatus.APPROVED, PurchaseStatus.ORDERED,
                            PurchaseStatus.PARTIALLY_RECEIVED}:
        raise Conflict("Only an open approved order can be received")
    remaining = Decimal(order.quantity) - Decimal(order.received_quantity)
    quantity = quantity if quantity is not None else remaining
    if quantity <= 0 or quantity > remaining:
        raise Conflict("Receipt exceeds the unreceived order quantity")
    movement = move_stock(db, property_id, order.item_id, quantity, MovementReason.PURCHASE,
        actor_id=actor_id, note="Purchase order received", source_ref=order.id,
        department_id=order.department_id, commit=False)
    order.received_quantity = Decimal(order.received_quantity) + quantity
    order.status = (PurchaseStatus.RECEIVED if order.received_quantity == order.quantity
                    else PurchaseStatus.PARTIALLY_RECEIVED)
    order.received_at = utcnow() if order.status == PurchaseStatus.RECEIVED else None
    db.add(PurchaseOperation(order_id=order.id, operation_id=operation_id,
        kind="receipt", quantity=quantity, movement_id=movement.id, created_at=utcnow()))
    db.commit()
    db.refresh(order)
    publish_movement(property_id, movement.item, movement, actor_id)
    return order


def return_purchase_order(db: Session, property_id: UUID, order_id: UUID, *, actor_id: UUID,
                          quantity: Decimal, operation_id: UUID, reason: str) -> PurchaseOrder:
    order = _locked_order(db, property_id, order_id)
    existing = db.scalars(select(PurchaseOperation).where(
        PurchaseOperation.order_id == order_id,
        PurchaseOperation.operation_id == operation_id
    )).first()
    if existing:
        if existing.kind != "return" or existing.quantity != quantity:
            raise Conflict("Operation ID was already used for a different return")
        return order
    if quantity <= 0 or quantity > Decimal(order.received_quantity) - Decimal(order.returned_quantity):
        raise Conflict("Return exceeds the net received quantity")
    movement = move_stock(db, property_id, order.item_id, -quantity, MovementReason.RETURN,
        actor_id=actor_id, note=reason, source_ref=order.id,
        department_id=order.department_id, commit=False)
    order.returned_quantity = Decimal(order.returned_quantity) + quantity
    db.add(PurchaseOperation(order_id=order.id, operation_id=operation_id,
        kind="return", quantity=quantity, movement_id=movement.id, created_at=utcnow()))
    db.commit()
    db.refresh(order)
    publish_movement(property_id, movement.item, movement, actor_id)
    return order


def cancel_purchase_order(db: Session, property_id: UUID, order_id: UUID) -> PurchaseOrder:
    order = _locked_order(db, property_id, order_id)
    if order.status == PurchaseStatus.RECEIVED:
        raise Conflict("That order has already been received")
    if order.status == PurchaseStatus.CANCELLED:
        return order
    order.status = PurchaseStatus.CANCELLED
    order.reorder_key = None
    db.commit()
    db.refresh(order)
    maybe_flag_low(db, property_id, get_item(db, property_id, order.item_id))
    return order


def summary(db: Session, property_id: UUID, *, department_ids: set[str] | None = None) -> dict:
    """Stock tiles on the owner dashboard."""
    items = list_items(db, property_id)
    if department_ids is not None:
        items = [item for item in items if str(item.department_id) in department_ids]
    low = [i for i in items if i.is_low]
    expiring = [
        i for i in items if i.days_to_expiry is not None and i.days_to_expiry <= EXPIRY_WARNING_DAYS
    ]
    value = sum(Decimal(i.quantity) * Decimal(i.unit_cost) for i in items)
    pending = list_purchase_orders(db, property_id, status=PurchaseStatus.SUGGESTED)
    if department_ids is not None:
        visible_ids = {item.id for item in items}
        pending = [order for order in pending if order.item_id in visible_ids]
    return {
        "total_items": len(items),
        "low_stock_items": len(low),
        "expiring_items": len(expiring),
        "stock_value": float(value),
        "pending_suggestions": len(pending),
    }
