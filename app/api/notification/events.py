"""Notification turns everything on the bus into something a person sees.

Two jobs: push live events to open sockets, and queue the ones that need to leave the
building (an overdue alert to a manager, a retention offer to a guest).
"""
import asyncio
import logging
from uuid import UUID

from vesper_common.app_factory import on_events
from vesper_common.db import session_scope
from vesper_common.events import Envelope, Event

from . import service
from .models import Channel

log = logging.getLogger(__name__)

# Everything worth showing live on a dashboard or a phone.
LIVE_EVENTS = {
    Event.SUPPORT_ESCALATED.value,
    Event.COMMUNICATION_MESSAGE.value,
    Event.REQUEST_RAISED.value,
    Event.REQUEST_ACCEPTED.value,
    Event.REQUEST_DELIVERED.value,
    Event.REQUEST_OVERDUE.value,
    Event.TASK_CREATED.value,
    Event.TASK_ASSIGNED.value,
    Event.TASK_COMPLETED.value,
    Event.ROOM_STATUS_CHANGED.value,
    Event.ATTENDANCE_MARKED.value,
    Event.STOCK_LOW.value,
    Event.GUEST_CHECKED_IN.value,
    Event.GUEST_CHECKED_OUT.value,
    Event.CARD_CREATED.value,
    Event.CARD_EXECUTED.value,
    Event.CARD_UNDONE.value,
    Event.ISSUE_REPORTED.value,
    Event.ANOMALY_DETECTED.value,
}

# These also need to reach someone who is not looking at a screen.
OUTBOUND_EVENTS = {Event.REQUEST_OVERDUE.value, Event.NOTIFY.value}

WATCHED = LIVE_EVENTS | OUTBOUND_EVENTS

# The event loop the FastAPI app runs on. The bus consumer is a plain thread, so a
# broadcast has to be handed across rather than awaited directly.
_loop: asyncio.AbstractEventLoop | None = None


def bind_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


@on_events("notification-service", WATCHED)
def handle(envelope: Envelope) -> None:
    if not envelope.property_id:
        return

    if envelope.name in LIVE_EVENTS:
        _push_live(envelope)
    if envelope.name in OUTBOUND_EVENTS:
        _queue_outbound(envelope)


def _push_live(envelope: Envelope) -> None:
    if _loop is None:
        return
    event = {
        "type": envelope.name,
        "payload": envelope.payload,
        "occurred_at": envelope.occurred_at,
        "id": envelope.id,
    }
    department_id = envelope.payload.get("department_id")
    try:
        # The consumer runs on its own thread; hop back onto the app's loop to send.
        asyncio.run_coroutine_threadsafe(
            service.hub.broadcast(envelope.property_id, event, department_id=department_id),
            _loop,
        )
    except RuntimeError:
        log.warning("could not schedule a broadcast for %s", envelope.name)


def _queue_outbound(envelope: Envelope) -> None:
    payload = envelope.payload
    db = session_scope()
    try:
        if envelope.name == Event.REQUEST_OVERDUE.value:
            service.queue(
                db,
                UUID(envelope.property_id),
                channel=Channel.WHATSAPP,
                # The department manager's number is resolved by the mock provider; the
                # department is what identifies the recipient here.
                recipient=f"department:{payload.get('department_id')}",
                subject="Overdue guest request",
                body=(
                    f"Room {payload.get('room_number')}: a {payload.get('kind')} request is "
                    f"{payload.get('overdue_by_minutes')} minutes past its SLA."
                ),
                kind=Event.REQUEST_OVERDUE.value,
                payload=payload,
            )
        elif envelope.name == Event.NOTIFY.value:
            channel = payload.get("channel", Channel.WHATSAPP.value)
            recipient = payload.get("recipient") or f"guest:{payload.get('guest_id')}"
            service.queue(
                db,
                UUID(envelope.property_id),
                channel=channel,
                recipient=recipient,
                subject=payload.get("subject"),
                body=payload.get("body", ""),
                kind=payload.get("kind", "notify"),
                payload=payload,
            )
        else:
            return

        # First attempt immediately; the retry loop owns everything after that.
        service.run_retries(db, UUID(envelope.property_id), limit=10)
    except Exception:
        log.exception("could not queue an outbound message for %s", envelope.name)
    finally:
        db.close()


start_subscriptions = handle
