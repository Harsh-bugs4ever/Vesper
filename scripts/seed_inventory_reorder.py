"""Idempotent demand histories and reorder examples for the unified demo seeder."""
from __future__ import annotations

import importlib
import sys
from datetime import timedelta
from decimal import Decimal, ROUND_CEILING
from uuid import UUID, NAMESPACE_URL, uuid5

from sqlalchemy import func, select

from vesper_common.clock import utcnow
from vesper_common.permissions import Perm

PATTERNS = {
    "FD-BREAD": 9, "FD-EGGS": 8, "FD-RICE": 4, "FD-BUTTER": 4,
    "BV-COFFEE": 3, "LN-TOWEL": 76, "TL-SHAMPOO": 97,
    "CL-FLOOR": 8, "TL-SOAP": 70,
}
VARIANCE = (-2, 1, 0, 3, -1, 2, -3, 1, 4, -2, 0, 2, -1, 3, -2, 1)


def _models(context: str):
    # seed.py loads vesper_models; importing app.api.* again duplicates tables.
    if f"vesper_models.{context}" in sys.modules:
        return importlib.import_module(f"vesper_models.{context}")
    return importlib.import_module(f"app.api.{context}.models")


def seed_inventory_reorder(db, property_id: UUID) -> dict[str, int]:
    inv = _models("inventory")
    action = _models("action")
    identity = _models("identity")
    items = {row.sku: row for row in db.scalars(select(inv.StockItem).where(
        inv.StockItem.property_id == property_id,
        inv.StockItem.sku.in_((*PATTERNS, "SP-BULB"))))}
    now = utcnow()
    movements_added = 0
    for sku, baseline in PATTERNS.items():
        item = items.get(sku)
        if item is None or db.scalar(select(func.count(inv.StockMovement.id)).where(
                inv.StockMovement.property_id == property_id,
                inv.StockMovement.item_id == item.id)):
            continue
        daily = [Decimal(max(1, baseline + VARIANCE[(day + len(sku)) % len(VARIANCE)]))
                 for day in range(16, 0, -1)]
        balance = Decimal(item.quantity) + sum(daily)
        for day, quantity in zip(range(16, 0, -1), daily):
            balance -= quantity
            db.add(inv.StockMovement(
                id=uuid5(NAMESPACE_URL, f"vesper:reorder-demo:{property_id}:{sku}:{day}"),
                property_id=property_id, department_id=item.department_id,
                item_id=item.id, quantity=-quantity, reason=inv.MovementReason.CONSUMPTION,
                note="Synthetic operational usage for reorder demonstration",
                balance_after=balance, created_at=now - timedelta(days=day),
                updated_at=now - timedelta(days=day)))
            movements_added += 1
    db.commit()

    coffee = items.get("BV-COFFEE")
    gm_id = db.scalar(select(identity.User.id).where(
        identity.User.property_id == property_id,
        identity.User.email == "gm@vesper.demo").limit(1))
    if coffee and gm_id and not db.scalar(select(inv.PurchaseOrder.id).where(
            inv.PurchaseOrder.property_id == property_id,
            inv.PurchaseOrder.item_id == coffee.id,
            inv.PurchaseOrder.status.in_((inv.PurchaseStatus.APPROVED,
                inv.PurchaseStatus.ORDERED, inv.PurchaseStatus.PARTIALLY_RECEIVED))).limit(1)):
        quantity = Decimal("30")
        budget_id = db.scalar(select(inv.DepartmentBudget.id).where(
            inv.DepartmentBudget.property_id == property_id,
            inv.DepartmentBudget.department_id == coffee.department_id).limit(1))
        db.add(inv.PurchaseOrder(property_id=property_id, department_id=coffee.department_id,
            budget_id=budget_id, currency="INR", item_id=coffee.id,
            quantity=quantity, unit_cost=coffee.unit_cost,
            total_cost=quantity * Decimal(coffee.unit_cost), supplier=coffee.supplier,
            status=inv.PurchaseStatus.APPROVED,
            approved_by=gm_id, approved_at=now,
            rationale={"seed_scenario": "incoming_stock"}))

    suggestions_added = 0
    for sku in ("FD-BREAD", "LN-TOWEL"):
        item = items.get(sku)
        if item is None or db.scalar(select(inv.PurchaseOrder.id).where(
                inv.PurchaseOrder.property_id == property_id,
                inv.PurchaseOrder.item_id == item.id,
                inv.PurchaseOrder.status == inv.PurchaseStatus.SUGGESTED).limit(1)):
            continue
        consumed = Decimal(db.scalar(select(func.coalesce(func.sum(-inv.StockMovement.quantity), 0)).where(
            inv.StockMovement.property_id == property_id, inv.StockMovement.item_id == item.id,
            inv.StockMovement.created_at >= now - timedelta(days=14),
            inv.StockMovement.quantity < 0,
            inv.StockMovement.reason == inv.MovementReason.CONSUMPTION)) or 0)
        daily = consumed / 14
        threshold = daily * (item.lead_time_days + item.safety_stock_days)
        target = daily * item.target_stock_days
        quantity = max(Decimal("0"),
            (target - Decimal(item.quantity)).to_integral_value(rounding=ROUND_CEILING))
        if quantity <= 0:
            continue
        db.add(inv.PurchaseOrder(property_id=property_id, department_id=item.department_id,
            currency="INR", item_id=item.id, quantity=quantity, unit_cost=item.unit_cost,
            total_cost=quantity * Decimal(item.unit_cost), supplier=item.supplier,
            status=inv.PurchaseStatus.SUGGESTED,
            reorder_key=f"{property_id}:{item.id}",
            rationale={"current_stock": str(item.quantity),
                "available_stock": str(item.quantity), "consumption_14d": str(consumed),
                "average_daily_usage": str(daily), "supplier_lead_time_days": item.lead_time_days,
                "safety_stock_days": item.safety_stock_days, "reorder_threshold": str(threshold),
                "recommended_quantity": str(quantity), "threshold_source": "14_day_usage"}))
        suggestions_added += 1
    db.commit()

    cards_added = 0
    for order in db.scalars(select(inv.PurchaseOrder).where(
            inv.PurchaseOrder.property_id == property_id,
            inv.PurchaseOrder.reorder_key.is_not(None),
            inv.PurchaseOrder.status == inv.PurchaseStatus.SUGGESTED)).all():
        item = db.get(inv.StockItem, order.item_id)
        if item is None:
            continue
        key = f"purchase:{item.id}"
        if db.scalar(select(action.ActionCard.id).where(
                action.ActionCard.property_id == property_id,
                action.ActionCard.dedupe_key == key,
                action.ActionCard.status.in_((action.CardStatus.PENDING,
                    action.CardStatus.CLAIMED, action.CardStatus.SNOOZED))).limit(1)):
            continue
        rationale = order.rationale
        db.add(action.ActionCard(property_id=property_id, engine="inventory",
            kind=action.CardKind.PURCHASE, status=action.CardStatus.PENDING,
            title=f"Reorder {item.name}",
            summary=(f"{item.name}: {rationale['available_stock']} available against a "
                     f"{rationale['reorder_threshold']} demand threshold. "
                     f"Review {order.quantity} {item.unit} for purchase."),
            drivers=[{"label": "14-day demand",
                      "detail": f"{rationale['consumption_14d']} consumed; {rationale['average_daily_usage']}/day",
                      "weight": 0.45},
                     {"label": "Delivery and safety cover",
                      "detail": f"{item.lead_time_days} delivery days + {item.safety_stock_days} safety days",
                      "weight": 0.35},
                     {"label": "Estimated cost", "detail": f"₹{order.total_cost}",
                      "weight": 0.20}],
            confidence=0.92, impact_amount=order.total_cost,
            urgency=action.Urgency.HIGH, score=0.6,
            required_permission=Perm.PURCHASE_APPROVE.value,
            payload={"purchase_order_id": str(order.id), "item_id": str(item.id),
                     "quantity": float(order.quantity), "analysis": rationale,
                     "editable_fields": ["quantity"]},
            expires_at=now + timedelta(days=3), dedupe_key=key))
        cards_added += 1
    db.commit()
    return {"consumption_movements": movements_added,
            "reorder_suggestions": suggestions_added, "reorder_cards": cards_added}
