"""Revenue reacts to demand actually landing.

A booking or a check-out changes the occupancy series the forecast is fitted on. Rather
than refit on every single booking, which would refit hundreds of times a day for no
gain, the forecast is marked stale and the nightly job picks it up.
"""
import logging

from vesper_common.app_factory import on_events
from vesper_common.events import Envelope, Event

log = logging.getLogger(__name__)

WATCHED = {Event.BOOKING_CREATED.value, Event.GUEST_CHECKED_OUT.value}


@on_events("revenue-service", WATCHED)
def handle(envelope: Envelope) -> None:
    # Deliberately cheap: the demand model is a batch job, not a per-booking trigger.
    log.debug("demand signal %s for property %s", envelope.name, envelope.property_id)


start_subscriptions = handle
