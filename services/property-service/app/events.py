"""Property reacts to the front desk.

Check-in occupies a room, check-out dirties it. Nobody has to remember to flip the board
by hand, which is the whole reason the 11:00 housekeeping fan-out works.
"""
import logging

from vesper_common.app_factory import on_events
from vesper_common.db import session_scope
from vesper_common.errors import VesperError
from vesper_common.events import Envelope, Event

from . import service
from .models import RoomStatus

log = logging.getLogger(__name__)

WATCHED = {Event.GUEST_CHECKED_IN.value, Event.GUEST_CHECKED_OUT.value}

NEXT_STATUS = {
    Event.GUEST_CHECKED_IN.value: RoomStatus.OCCUPIED.value,
    Event.GUEST_CHECKED_OUT.value: RoomStatus.DIRTY.value,
}


@on_events("property-service", WATCHED)
def handle(envelope: Envelope) -> None:
    room_id = envelope.payload.get("room_id")
    property_id = envelope.property_id
    if not room_id or not property_id:
        return
    from uuid import UUID

    db = session_scope()
    try:
        service.set_room_status(
            db,
            UUID(property_id),
            UUID(room_id),
            NEXT_STATUS[envelope.name],
            actor_id=envelope.actor_id,
            # The front desk is the source of truth for whether a room is occupied, so
            # its word overrides the housekeeping loop rather than conflicting with it.
            force=True,
        )
    except VesperError as exc:
        log.warning("could not apply %s to room %s: %s", envelope.name, room_id, exc)
    finally:
        db.close()


start_subscriptions = handle
