"""Periodic work owned by guest-service.

The SLA promise is only real if something checks it. A request that quietly passes its
deadline with nobody told is worse than never having promised a deadline.
"""
import logging
from uuid import UUID

from vesper_common.db import session_scope
from vesper_common.scheduler import Scheduler, for_each_property

from . import service

log = logging.getLogger(__name__)


def _sweep_overdue(property_id: str) -> None:
    db = session_scope()
    try:
        overdue = service.sweep_overdue(db, UUID(property_id))
        if overdue:
            log.info("alerted on %s overdue request(s)", len(overdue))
    finally:
        db.close()


def build() -> Scheduler:
    scheduler = Scheduler("guest-service")
    # A minute is the right granularity: any finer is noise, any coarser and a 30-minute
    # SLA can be five minutes late before anyone hears about it.
    scheduler.add("sweep-overdue-requests", 60, for_each_property(_sweep_overdue))
    return scheduler
