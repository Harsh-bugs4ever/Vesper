"""Guest-service keeps the guest's tracker honest.

When the kitchen marks the task delivered in the staff app, the guest's status bar must
move without anyone touching the request itself. That is this file's whole job.
"""
import logging
from uuid import UUID

from sqlalchemy import select

from vesper_common.app_factory import on_events
from vesper_common.db import session_scope
from vesper_common.errors import VesperError
from vesper_common.events import Envelope, Event

from . import service
from .models import RequestStatus, ServiceRequest

log = logging.getLogger(__name__)

WATCHED = {Event.TASK_ASSIGNED.value, Event.TASK_COMPLETED.value}

# staff-service stamps the request id it came from onto the task.
STATUS_FOR_EVENT = {
    Event.TASK_ASSIGNED.value: RequestStatus.IN_PROGRESS.value,
    Event.TASK_COMPLETED.value: RequestStatus.DELIVERED.value,
}


@on_events("guest-service", WATCHED)
def handle(envelope: Envelope) -> None:
    payload = envelope.payload
    if payload.get("source") != "guest_request" or not payload.get("source_ref"):
        return
    if not envelope.property_id:
        return

    db = session_scope()
    try:
        request = db.scalars(
            select(ServiceRequest).where(ServiceRequest.id == UUID(payload["source_ref"]))
        ).first()
        if request is None:
            return
        target = STATUS_FOR_EVENT[envelope.name]
        # Never walk a request backwards: a late TASK_ASSIGNED must not un-deliver an
        # order the guest has already seen arrive.
        if request.status in {RequestStatus.DELIVERED, RequestStatus.CANCELLED}:
            return
        if (
            target == RequestStatus.IN_PROGRESS
            and request.status == RequestStatus.RAISED
            and payload.get("assignee_id")
        ):
            # Record who picked it up before moving the guest's tracker along.
            service.accept_request(
                db, UUID(envelope.property_id), request.id, UUID(payload["assignee_id"])
            )
        service.set_request_status(
            db,
            UUID(envelope.property_id),
            request.id,
            target,
            actor_id=envelope.actor_id or "system",
        )
    except VesperError as exc:
        log.info("no status change for %s: %s", payload.get("source_ref"), exc)
    except Exception:
        log.exception("failed to sync request from %s", envelope.name)
    finally:
        db.close()


start_subscriptions = handle
