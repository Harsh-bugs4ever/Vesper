"""Workforce watches attendance to keep the roster honest.

Today's no-shows are tomorrow's staffing gaps. The roster itself is a batch job, so this
only records the signal rather than re-solving on every check-in.
"""
import logging

from vesper_common.app_factory import on_events
from vesper_common.events import Envelope, Event

log = logging.getLogger(__name__)

WATCHED = {Event.ATTENDANCE_MARKED.value}


@on_events("workforce-service", WATCHED)
def handle(envelope: Envelope) -> None:
    payload = envelope.payload
    if payload.get("direction") == "in" and payload.get("is_late"):
        log.info(
            "late check-in: user=%s by=%s min",
            payload.get("user_id"),
            payload.get("late_by_minutes"),
        )


start_subscriptions = handle
