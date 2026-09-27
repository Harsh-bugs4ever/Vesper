"""Stock moves itself when work completes.

A delivered room-service order deducts its recipe; an approved purchase card creates the
order. Nobody counts bread by hand at 09:45 because a sandwich went upstairs.
"""
import logging
from uuid import UUID

from vesper_common.app_factory import on_events
from vesper_common.db import session_scope
from vesper_common.errors import VesperError
from vesper_common.events import Envelope, Event

from . import service

log = logging.getLogger(__name__)

WATCHED = {Event.REQUEST_DELIVERED.value, Event.STOCK_MOVED.value,
           Event.CARD_DISMISSED.value}


@on_events("inventory-service", WATCHED)
def handle(envelope: Envelope) -> None:
    payload = envelope.payload
    if not envelope.property_id:
        return

    db = session_scope()
    try:
        property_id = UUID(envelope.property_id)
        if envelope.name == Event.STOCK_MOVED.value:
            if float(payload.get("quantity", 0)) < 0 and payload.get("item_id"):
                item = service.get_item(db, property_id, UUID(payload["item_id"]))
                service.maybe_flag_low(db, property_id, item)
            return
        if envelope.name == Event.CARD_DISMISSED.value:
            if payload.get("engine") == "inventory" and payload.get("purchase_order_id"):
                service.close_suggestion(db, property_id, UUID(payload["purchase_order_id"]),
                                         reason=envelope.name)
            return
        if not payload.get("items"):
            return
        source_ref = UUID(payload["request_id"]) if payload.get("request_id") else None
        for line in payload["items"]:
            recipe = line.get("recipe") or {}
            if not recipe:
                continue
            service.consume_recipe(
                db,
                property_id,
                recipe,
                multiplier=int(line.get("quantity", 1)),
                source_ref=source_ref,
            )
    except VesperError as exc:
        log.warning("stock deduction failed for %s: %s", payload.get("request_id"), exc)
    except Exception:
        log.exception("unexpected failure deducting stock")
    finally:
        db.close()


start_subscriptions = handle
