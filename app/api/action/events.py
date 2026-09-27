"""Turning facts into decisions.

Inventory says bread is low; that is a fact. Action-service turns it into a card with
drivers, a rupee impact and an urgency, and puts it in front of whoever may approve it.
Revenue, maintenance and workforce post their cards over HTTP because they compute on a
schedule; inventory's trigger is an event, so it is handled here.
"""
import logging
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID

from vesper_common.app_factory import on_events
from vesper_common.clock import utcnow
from vesper_common.db import session_scope
from vesper_common.events import Envelope, Event
from vesper_common.permissions import Perm

from . import service
from .models import CardKind, Urgency

log = logging.getLogger(__name__)

WATCHED = {Event.STOCK_LOW.value, Event.ANOMALY_DETECTED.value}


@on_events("action-service", WATCHED)
def handle(envelope: Envelope) -> None:
    if not envelope.property_id:
        return
    db = session_scope()
    try:
        if envelope.name == Event.STOCK_LOW.value:
            _purchase_card(db, envelope)
        elif envelope.name == Event.ANOMALY_DETECTED.value:
            _work_order_card(db, envelope)
    except Exception:
        log.exception("could not raise a card from %s", envelope.name)
    finally:
        db.close()


def _purchase_card(db, envelope: Envelope) -> None:
    payload = envelope.payload
    analysis = payload.get("analysis") or {}
    on_hand = float(payload.get("on_hand", 0))
    minimum = float(payload.get("minimum", 0)) or 1.0
    lead_time = int(payload.get("lead_time_days", 2))
    cost = Decimal(str(payload.get("estimated_cost", 0)))

    # Already out of stock is a different conversation from nearly out of stock.
    if on_hand <= 0:
        urgency = Urgency.CRITICAL
    elif on_hand < minimum * 0.5:
        urgency = Urgency.HIGH
    else:
        urgency = Urgency.MEDIUM

    # Confidence here is genuinely high: this is a counted number against a threshold
    # somebody set, not a forecast.
    confidence = 0.92

    service.create_card(
        db,
        UUID(envelope.property_id),
        SimpleNamespace(
            engine="inventory",
            kind=CardKind.PURCHASE.value,
            title=f"Reorder {payload.get('name', 'stock item')}",
            summary=(f"{payload.get('name')} has {analysis.get('available_stock', on_hand)} "
                f"{payload.get('unit', 'units')} available against a demand-based reorder "
                f"threshold of {minimum:g}. Order {payload.get('suggested_quantity')} "
                f"{payload.get('unit', 'units')} after review."),
            drivers=[
                {
                    "label": "14-day demand",
                    "detail": (f"{analysis.get('consumption_14d', 0)} consumed; "
                               f"{analysis.get('average_daily_usage', 0)}/day"),
                    "weight": 0.45,
                },
                {
                    "label": "Delivery and safety cover",
                    "detail": (f"{lead_time} delivery days + "
                               f"{analysis.get('safety_stock_days', 0)} safety days "
                               f"= {minimum:g} threshold"),
                    "weight": 0.35,
                },
                {
                    "label": "Available and cost",
                    "detail": (f"{analysis.get('available_stock', on_hand)} available; "
                               f"estimated ₹{cost:,.0f}"),
                    "weight": 0.20,
                },
            ],
            confidence=confidence,
            impact_amount=cost,
            urgency=urgency,
            department_id=None,
            required_permission=Perm.PURCHASE_APPROVE.value,
            payload={
                "purchase_order_id": payload.get("purchase_order_id"),
                "item_id": payload.get("item_id"),
                "quantity": payload.get("suggested_quantity"),
                "analysis": analysis,
                # The manager may change how much to order, nothing else.
                "editable_fields": ["quantity"],
            },
            expires_at=utcnow() + timedelta(days=3),
            dedupe_key=f"purchase:{payload.get('item_id')}",
        ),
    )


def _work_order_card(db, envelope: Envelope) -> None:
    payload = envelope.payload
    risk = float(payload.get("risk_score", 0.5))
    downtime_cost = Decimal(str(payload.get("estimated_downtime_cost", 0)))

    service.create_card(
        db,
        UUID(envelope.property_id),
        SimpleNamespace(
            engine="maintenance",
            kind=CardKind.WORK_ORDER.value,
            title=f"Service {payload.get('asset_name', 'asset')} before it fails",
            summary=payload.get("summary", "Sensor readings are drifting outside their normal band."),
            drivers=payload.get("drivers", []),
            confidence=risk,
            impact_amount=downtime_cost,
            urgency=Urgency.CRITICAL if risk >= 0.85 else Urgency.HIGH,
            department_id=UUID(payload["department_id"]) if payload.get("department_id") else None,
            required_permission=Perm.WORKORDER_APPROVE.value,
            payload={
                "asset_id": payload.get("asset_id"),
                "suggested_window": payload.get("suggested_window"),
                "editable_fields": ["suggested_window"],
                # staff-service creates this task when the card is approved.
                "task": {
                    "title": f"Service {payload.get('asset_name', 'asset')}",
                    "description": payload.get("summary"),
                    "department_id": payload.get("department_id"),
                    "priority": "high",
                    "due_in_minutes": 60 * 24,
                },
            },
            expires_at=utcnow() + timedelta(days=7),
            dedupe_key=f"work_order:{payload.get('asset_id')}",
        ),
    )


start_subscriptions = handle
