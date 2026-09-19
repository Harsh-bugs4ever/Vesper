"""Periodic work owned by notification-service.

Without this the outbox is a list of things that failed once and will never be tried
again — which is the same as losing them, only with a record.
"""
import logging
from uuid import UUID

from vesper_common.db import session_scope
from vesper_common.scheduler import Scheduler, for_each_property

from . import service

log = logging.getLogger(__name__)


def _run_retries(property_id: str) -> None:
    db = session_scope()
    try:
        result = service.run_retries(db, UUID(property_id))
        if result["attempted"]:
            log.info("outbox: %s", result)
    finally:
        db.close()


def build() -> Scheduler:
    scheduler = Scheduler("notification-service")
    # The backoff schedule inside deliver() decides what is actually due; this only has
    # to tick often enough to honour the shortest step, which is one minute.
    scheduler.add("outbox-retries", 60, for_each_property(_run_retries))
    return scheduler
