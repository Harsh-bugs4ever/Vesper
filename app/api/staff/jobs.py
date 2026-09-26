"""Periodic jobs for staff service."""
import logging
from uuid import UUID

from vesper_common.db import session_scope
from vesper_common.scheduler import Scheduler, for_each_property

from . import events

log = logging.getLogger(__name__)


def _reconcile_requests(property_id: str) -> None:
    db = session_scope()
    try:
        count = events.reconcile_guest_requests(db, UUID(property_id))
        if count:
            log.info("reconciled %s dropped guest request(s)", count)
    finally:
        db.close()


def build() -> Scheduler:
    scheduler = Scheduler("staff-service")
    scheduler.add("reconcile-guest-requests", 60, for_each_property(_reconcile_requests))
    return scheduler
