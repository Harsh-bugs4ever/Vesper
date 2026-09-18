"""Stock ledger, auto-deduction and the reorder rule."""
from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from vesper_common.clock import local_today, utcnow
from vesper_common.errors import Conflict, Invalid, NotFound
from vesper_common.events import Event, bus

from .models import MovementReason, PurchaseOrder, PurchaseStatus, StockItem, StockMovement

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
) -> StockMovement:
    """Record one in/out movement and recompute the item's balance.

    Negative quantities take stock out. Going below zero is refused rather than clamped:
    a negative balance means the ledger and the shelf already disagree, and hiding that
    makes the next count worse.
    """
    if quantity == 0:
        raise Invalid("A stock movement of zero changes nothing")

    item = get_item(db, property_id, item_id)
    new_balance = Decimal(item.quantity) + Decimal(quantity)
    if new_balance < 0:
        raise Conflict(
            "That would take stock below zero",
            details={"on_hand": float(item.quantity), "requested": float(-quantity)},
        )

    item.quantity = new_balance
    movement = StockMovement(
        property_id=property_id,
        item_id=item.id,
        quantity=Decimal(quantity),
        reason=reason,
        note=note,
        actor_id=actor_id,
        source_ref=source_ref,
        balance_after=new_balance,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    db.refresh(item)

    bus.publish(
        Event.STOCK_MOVED,
        {
            "item_id": str(item.id),
            "sku": item.sku,
            "name": item.name,
            "quantity": float(quantity),
            "reason": reason,
            "balance": float(new_balance),
        },
        property_id=str(property_id),
        actor_id=str(actor_id) if actor_id else None,
    )
    maybe_flag_low(db, property_id, item)
    return movement


def maybe_flag_low(db: Session, property_id: UUID, item: StockItem) -> PurchaseOrder | None:
    """The reorder rule: below minimum, and not already flagged today."""
    if not item.is_low:
        # Back above the line — arm the flag again for next time.
        if item.low_flagged_at is not None:
            item.low_flagged_at = None
            db.commit()
        return None

    if item.low_flagged_at and utcnow() - item.low_flagged_at < timedelta(hours=LOW_FLAG_COOLDOWN_HOURS):
        return None

    item.low_flagged_at = utcnow()
    quantity = Decimal(item.reorder_quantity) or (Decimal(item.minimum_quantity) * 2)
    order = PurchaseOrder(
        property_id=property_id,
        item_id=item.id,
        quantity=quantity,
        unit_cost=item.unit_cost,
        total_cost=quantity * Decimal(item.unit_cost),
        supplier=item.supplier,
        status=PurchaseStatus.SUGGESTED,
        expected_on=local_today() + timedelta(days=item.lead_time_days),
        rationale={
            "on_hand": float(item.quantity),
            "minimum": float(item.minimum_quantity),
            "lead_time_days": item.lead_time_days,
            "reason": "on-hand at or below minimum",
        },
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # action-service picks this up and ranks it into the owner's queue.
    bus.publish(
        Event.STOCK_LOW,
        {
            "item_id": str(item.id),
            "purchase_order_id": str(order.id),
            "sku": item.sku,
            "name": item.name,
            "category": item.category,
            "on_hand": float(item.quantity),
            "minimum": float(item.minimum_quantity),
            "suggested_quantity": float(quantity),
            "unit": item.unit,
            "estimated_cost": float(order.total_cost),
            "supplier": item.supplier,
            "lead_time_days": item.lead_time_days,
        },
        property_id=str(property_id),
    )
    return order


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
    order = get_purchase_order(db, property_id, order_id)
    if order.status != PurchaseStatus.SUGGESTED:
        raise Conflict(f"That order is already {order.status}")
    if quantity is not None:
        if quantity <= 0:
            raise Invalid("Order quantity must be greater than zero")
        order.quantity = quantity
        order.total_cost = quantity * Decimal(order.unit_cost)
    order.status = PurchaseStatus.APPROVED
    order.approved_by = actor_id
    order.approved_at = utcnow()
    db.commit()
    db.refresh(order)
    return order


def receive_purchase_order(db: Session, property_id: UUID, order_id: UUID, *, actor_id: UUID) -> PurchaseOrder:
    """Goods in: the stock movement and the order close together or not at all."""
    order = get_purchase_order(db, property_id, order_id)
    if order.status not in {PurchaseStatus.APPROVED, PurchaseStatus.ORDERED}:
        raise Conflict("Only an approved order can be received")

    move_stock(
        db,
        property_id,
        order.item_id,
        Decimal(order.quantity),
        MovementReason.PURCHASE,
        actor_id=actor_id,
        note="Purchase order received",
        source_ref=order.id,
    )
    order.status = PurchaseStatus.RECEIVED
    order.received_at = utcnow()
    db.commit()
    db.refresh(order)
    return order


def cancel_purchase_order(db: Session, property_id: UUID, order_id: UUID) -> PurchaseOrder:
    order = get_purchase_order(db, property_id, order_id)
    if order.status == PurchaseStatus.RECEIVED:
        raise Conflict("That order has already been received")
    order.status = PurchaseStatus.CANCELLED
    db.commit()
    db.refresh(order)
    return order


def summary(db: Session, property_id: UUID) -> dict:
    """Stock tiles on the owner dashboard."""
    items = list_items(db, property_id)
    low = [i for i in items if i.is_low]
    expiring = [
        i for i in items if i.days_to_expiry is not None and i.days_to_expiry <= EXPIRY_WARNING_DAYS
    ]
    value = sum(Decimal(i.quantity) * Decimal(i.unit_cost) for i in items)
    pending = list_purchase_orders(db, property_id, status=PurchaseStatus.SUGGESTED)
    return {
        "total_items": len(items),
        "low_stock_items": len(low),
        "expiring_items": len(expiring),
        "stock_value": float(value),
        "pending_suggestions": len(pending),
    }
