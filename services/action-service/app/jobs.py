"""Periodic work owned by action-service."""
import logging
from uuid import UUID

from vesper_common.db import session_scope
from vesper_common.scheduler import Scheduler, for_each_property

from . import service

log = logging.getLogger(__name__)


def _expire_stale(property_id: str) -> None:
    db = session_scope()
    try:
        changed = service.expire_stale(db, UUID(property_id))
        if changed:
            log.info("expired or released %s card(s)", changed)
    finally:
        db.close()


def build() -> Scheduler:
    scheduler = Scheduler("action-service")
    # Also releases claims nobody followed through on, so it needs to be brisk: a card
    # held by a closed laptop should come back to the queue promptly.
    scheduler.add("expire-stale-cards", 120, for_each_property(_expire_stale))
    return scheduler
