"""Maintenance turns approved cards into real work orders.

When a work-order card is approved, action-service publishes CARD_EXECUTED. Two services
react: staff-service makes the task somebody's phone shows, and this one records the
work order the task belongs to.
"""
import logging
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID

from vesper_common.app_factory import on_events
from vesper_common.db import session_scope
from vesper_common.events import Envelope, Event

from . import service
from .models import WorkOrderKind

log = logging.getLogger(__name__)

WATCHED = {Event.CARD_EXECUTED.value}


@on_events("maintenance-service", WATCHED)
def handle(envelope: Envelope) -> None:
    payload = envelope.payload
    if payload.get("kind") != "work_order" or not envelope.property_id:
        return
    # A shadow-mode approval must not create real work.
    if payload.get("shadow"):
        log.info("shadow mode: not creating a work order for card %s", payload.get("card_id"))
        return

    card_payload = payload.get("payload") or {}
    asset_id = card_payload.get("asset_id")
    if not asset_id:
        return

    window = card_payload.get("suggested_window") or {}
    db = session_scope()
    try:
        service.create_work_order(
            db,
            UUID(envelope.property_id),
            SimpleNamespace(
                asset_id=UUID(asset_id),
                title=(card_payload.get("task") or {}).get("title", "Scheduled service"),
                description=(card_payload.get("task") or {}).get("description"),
                kind=WorkOrderKind.PREVENTIVE,
                priority="high",
                department_id=UUID(card_payload["task"]["department_id"])
                if (card_payload.get("task") or {}).get("department_id")
                else None,
                scheduled_for=date.fromisoformat(window["date"]) if window.get("date") else None,
                scheduling_rationale=window,
                estimated_cost=Decimal(str(payload.get("impact_amount", 0))),
            ),
            source_card_id=UUID(payload["card_id"]) if payload.get("card_id") else None,
        )
    except Exception:
        log.exception("could not create a work order from card %s", payload.get("card_id"))
    finally:
        db.close()


start_subscriptions = handle
