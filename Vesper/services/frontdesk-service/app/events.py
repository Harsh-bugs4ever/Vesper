"""Front desk records what a guest actually did, wherever they did it.

A delivered room-service order is a visit too. Counting only room nights would tell the
retention engine a regular who eats here weekly has stopped coming.
"""
import logging
from decimal import Decimal
from uuid import UUID

from vesper_common.app_factory import on_events
from vesper_common.db import session_scope
from vesper_common.events import Envelope, Event

from . import service
from .models import VisitKind

log = logging.getLogger(__name__)

WATCHED = {Event.REQUEST_DELIVERED.value}


@on_events("frontdesk-service", WATCHED)
def handle(envelope: Envelope) -> None:
    payload = envelope.payload
    guest_id = payload.get("guest_id")
    # Room service is the only request kind that carries money; towels are not a visit.
    if not guest_id or not envelope.property_id or payload.get("kind") != "room_service":
        return

    db = session_scope()
    try:
        service.record_visit(
            db,
            UUID(envelope.property_id),
            guest_id=UUID(guest_id),
            kind=VisitKind.ROOM_SERVICE,
            amount=Decimal(str(payload.get("total_amount", 0))),
            stay_id=UUID(payload["stay_id"]) if payload.get("stay_id") else None,
            outlet="In-room dining",
            meta={"request_id": payload.get("request_id")},
        )
    except Exception:
        log.exception("could not record room-service visit for guest %s", guest_id)
    finally:
        db.close()


start_subscriptions = handle
