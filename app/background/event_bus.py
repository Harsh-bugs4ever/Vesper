"""Redis consumers.

Each module keeps the subscriptions it always had, in its own events.py. Splitting
the process apart never changed what they listen to, and neither does joining it
back together: inventory still publishes `stock.low`, the action queue still turns
it into a card, and neither knows the other is now in the same process.

Every consumer runs on its own daemon thread (see `vesper_common.events`), and each
keeps its own consumer group, so a handler that is slow or fails cannot hold up
another module's events.
"""
from __future__ import annotations

import logging

from app.api import MODULES

log = logging.getLogger(__name__)


def start() -> None:
    """Start every module's subscriptions. Called once, from the lifespan hook."""
    started = []
    for module in MODULES:
        subscribe = getattr(module, "start_subscriptions", None)
        if subscribe is None:
            continue
        try:
            subscribe()
        except Exception:
            # One module's bad subscription must not stop the rest from listening.
            log.exception("could not start subscriptions for %s", module.NAME)
        else:
            started.append(module.NAME)
    log.info("event consumers running for: %s", ", ".join(started) or "nothing")
