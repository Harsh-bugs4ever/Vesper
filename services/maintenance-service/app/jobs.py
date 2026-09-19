"""Periodic work owned by maintenance-service.

The risk sweep is what turns a fortnight of sensor readings into a card somebody acts on.
Nothing else triggers it, so without this the maintenance screen stays empty forever.
"""
import logging
from uuid import UUID

from vesper_common.db import session_scope
from vesper_common.scheduler import Scheduler, for_each_property

from . import service

log = logging.getLogger(__name__)


def _assess_all(property_id: str) -> None:
    db = session_scope()
    try:
        results = service.assess_all(db, UUID(property_id))
        at_risk = [r for r in results if r.risk_score >= service.CARD_RISK_THRESHOLD]
        log.info("assessed %s asset(s), %s above the card threshold", len(results), len(at_risk))
    finally:
        db.close()


def build() -> Scheduler:
    scheduler = Scheduler("maintenance-service")
    # Six-hourly rather than nightly: a chiller can deteriorate over an afternoon, and
    # the sweep is cheap.
    scheduler.add("assess-asset-risk", 6 * 3600, for_each_property(_assess_all))
    return scheduler
