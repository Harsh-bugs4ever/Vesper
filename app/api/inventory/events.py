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

WATCHED = {Event.REQUEST_DELIVERED.value}


@on_events("inventory-service", WATCHED)
def handle(envelope: Envelope) -> None:
    payload = envelope.payload
    if not envelope.property_id or not payload.get("items"):
        return

    db = session_scope()
    try:
        property_id = UUID(envelope.property_id)
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
