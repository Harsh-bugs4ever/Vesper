"""Compatibility consumer for front desk events.

Active stays determine occupancy, and checkout updates the room in its own transaction.
"""

from vesper_common.app_factory import on_events
from vesper_common.events import Envelope, Event

WATCHED = {Event.GUEST_CHECKED_IN.value, Event.GUEST_CHECKED_OUT.value}

@on_events("property-service", WATCHED)
def handle(envelope: Envelope) -> None:
    # Occupancy comes from active stays. Checkout changes housekeeping and rotates
    # the QR secret in its transaction; delayed events must not undo later cleaning.
    return


start_subscriptions = handle
