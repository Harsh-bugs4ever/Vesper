"""Demand-based reorder analysis using the existing stock ledger and purchase orders."""
from __future__ import annotations

from datetime import timedelta, timezone
from decimal import Decimal, ROUND_CEILING
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from vesper_common.clock import utcnow

from .models import MovementReason, PurchaseOrder, PurchaseStatus, StockItem, StockMovement

WINDOW_DAYS = 14
DEFAULT_LEAD_DAYS = 3
INCOMING_STATUSES = (PurchaseStatus.APPROVED, PurchaseStatus.ORDERED, PurchaseStatus.PARTIALLY_RECEIVED)
DEMAND_REASONS = (MovementReason.CONSUMPTION, MovementReason.WASTAGE, MovementReason.EXPIRY)


def _round_quantity(quantity: Decimal, unit: str) -> Decimal:
    step = Decimal("0.001") if unit.lower() in {"kg", "l", "litre", "liter"} else Decimal("1")
    return max(Decimal("0"), (quantity / step).to_integral_value(rounding=ROUND_CEILING) * step)


def analyze(db: Session, item: StockItem) -> dict:
    """Return a transparent, property-scoped calculation without mutating the ledger."""
    now = utcnow()
    cutoff = now - timedelta(days=WINDOW_DAYS)
    consumption = db.scalar(select(func.coalesce(func.sum(-StockMovement.quantity), 0)).where(
        StockMovement.property_id == item.property_id,
        StockMovement.item_id == item.id,
        StockMovement.created_at >= cutoff,
        StockMovement.quantity < 0,
        StockMovement.reason.in_(DEMAND_REASONS),
    ))
    consumed = Decimal(consumption or 0)
    first_movement = db.scalar(select(func.min(StockMovement.created_at)).where(
        StockMovement.property_id == item.property_id, StockMovement.item_id == item.id,
    ))
    if first_movement is not None and first_movement.tzinfo is None:
        first_movement = first_movement.replace(tzinfo=timezone.utc)
    history_days = min(WINDOW_DAYS, max(1, (now - first_movement).total_seconds() / 86400)) if first_movement else 0
    daily = consumed / Decimal(str(history_days)) if history_days and consumed > 0 else Decimal("0")
    source = "14_day_usage" if history_days >= WINDOW_DAYS else ("limited_history" if daily > 0 else "manual")
    lead = max(0, item.lead_time_days if item.lead_time_days is not None else DEFAULT_LEAD_DAYS)
    safety_days = max(0, item.safety_stock_days)
    safety = daily * safety_days
    threshold = daily * (lead + safety_days) if daily > 0 else Decimal(item.minimum_quantity)
    incoming = db.scalar(select(func.coalesce(func.sum(PurchaseOrder.quantity - PurchaseOrder.received_quantity), 0)).where(
        PurchaseOrder.property_id == item.property_id,
        PurchaseOrder.item_id == item.id,
        PurchaseOrder.status.in_(INCOMING_STATUSES),
    ))
    incoming = max(Decimal("0"), Decimal(incoming or 0))
    reserved = Decimal("0")  # No reservation ledger exists yet.
    available = Decimal(item.quantity) + incoming - reserved
    target = daily * max(0, item.target_stock_days) if daily > 0 else Decimal(item.reorder_quantity)
    recommended = _round_quantity(target - available, item.unit)
    pending = db.scalar(select(PurchaseOrder.id).where(
        PurchaseOrder.property_id == item.property_id,
        PurchaseOrder.item_id == item.id,
        PurchaseOrder.status == PurchaseStatus.SUGGESTED,
        PurchaseOrder.request_line_id.is_(None),
    ).limit(1))
    days_remaining = available / daily if daily > 0 else None
    requires = daily > 0 and available <= threshold and recommended > 0
    if pending:
        status = "po_pending"
    elif incoming > 0:
        status = "po_ordered"
    elif requires:
        status = "reorder_required"
    elif daily > 0 and available <= threshold + daily * 2:
        status = "approaching_reorder"
    else:
        status = "healthy"
    return {
        "item_id": item.id, "current_stock": Decimal(item.quantity), "incoming_stock": incoming,
        "reserved_stock": reserved, "available_stock": available, "consumption_14d": consumed,
        "average_daily_usage": daily, "supplier_lead_time_days": lead,
        "safety_stock_days": safety_days, "safety_stock": safety,
        "reorder_threshold": threshold, "target_stock": target,
        "recommended_quantity": recommended, "days_remaining": days_remaining,
        "requires_reorder": requires, "threshold_source": source,
        "status": status, "pending_purchase_order_id": pending,
    }


def snapshot(analysis: dict) -> dict:
    """JSON-safe immutable inputs saved on the suggested PO."""
    return {key: str(value) if isinstance(value, (Decimal, UUID)) else value
            for key, value in analysis.items()}
