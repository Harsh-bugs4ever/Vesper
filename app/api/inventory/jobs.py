"""Periodic work owned by inventory-service."""
import logging
from uuid import UUID
from sqlalchemy import select

from vesper_common.db import session_scope
from vesper_common.scheduler import Scheduler, for_each_property

from . import service
from .models import StockItem

log = logging.getLogger(__name__)


def _sweep_expiring(property_id: str) -> None:
    db = session_scope()
    try:
        items = service.sweep_expiring(db, UUID(property_id))
        if items:
            log.info("%s item(s) inside the expiry window", len(items))
    finally:
        db.close()


def _recalculate_reorder(property_id: str) -> None:
    db = session_scope()
    try:
        item_ids = db.scalars(select(StockItem.id).where(
            StockItem.property_id == UUID(property_id), StockItem.is_active.is_(True))).all()
        for item_id in item_ids:
            try:
                service.maybe_flag_low(db, UUID(property_id),
                                       service.get_item(db, UUID(property_id), item_id))
            except Exception:
                db.rollback()
                log.exception("could not recalculate reorder for item %s", item_id)
    finally:
        db.close()


def build() -> Scheduler:
    scheduler = Scheduler("inventory-service")
    # Expiry is a date, not a moment, so hourly is ample and keeps the badge correct
    # within an hour of midnight rolling over.
    scheduler.add("sweep-expiring-stock", 3600, for_each_property(_sweep_expiring))
    scheduler.add("recalculate-reorder", 86400, for_each_property(_recalculate_reorder))
    return scheduler
