"""Periodic work owned by inventory-service."""
import logging
from uuid import UUID

from vesper_common.db import session_scope
from vesper_common.scheduler import Scheduler, for_each_property

from . import service

log = logging.getLogger(__name__)


def _sweep_expiring(property_id: str) -> None:
    db = session_scope()
    try:
        items = service.sweep_expiring(db, UUID(property_id))
        if items:
            log.info("%s item(s) inside the expiry window", len(items))
    finally:
        db.close()


def build() -> Scheduler:
    scheduler = Scheduler("inventory-service")
    # Expiry is a date, not a moment, so hourly is ample and keeps the badge correct
    # within an hour of midnight rolling over.
    scheduler.add("sweep-expiring-stock", 3600, for_each_property(_sweep_expiring))
    return scheduler
