"""Guest intel listens for feedback and for anything that changes a guest's history.

A rating is scored the moment it arrives. A check-out or a delivered order changes the
visit pattern, so the guest's DNA and churn risk are rebuilt off the same events.
"""
import logging
from uuid import UUID

from vesper_common.app_factory import on_events
from vesper_common.db import session_scope
from vesper_common.errors import VesperError
from vesper_common.events import Envelope, Event

from . import service

log = logging.getLogger(__name__)

WATCHED = {
    Event.REQUEST_RATED.value,
    Event.GUEST_CHECKED_OUT.value,
    Event.REQUEST_DELIVERED.value,
}


@on_events("guest-intel-service", WATCHED)
def handle(envelope: Envelope) -> None:
    if not envelope.property_id:
        return
    payload = envelope.payload
    property_id = UUID(envelope.property_id)
    guest_id = payload.get("guest_id")

    db = session_scope()
    try:
        if envelope.name == Event.REQUEST_RATED.value:
            service.record_sentiment(
                db,
                property_id,
                comment=payload.get("comment"),
                rating=payload.get("rating"),
                guest_id=UUID(guest_id) if guest_id else None,
                request_id=UUID(payload["request_id"]) if payload.get("request_id") else None,
                department_id=UUID(payload["department_id"])
                if payload.get("department_id")
                else None,
            )

        # Any of these three changes what we know about the guest, so rebuild.
        if guest_id:
            service.build_dna(db, property_id, UUID(guest_id))
    except VesperError as exc:
        log.info("guest intel skipped %s: %s", envelope.name, exc)
    except Exception:
        log.exception("guest intel failed handling %s", envelope.name)
    finally:
        db.close()


start_subscriptions = handle
