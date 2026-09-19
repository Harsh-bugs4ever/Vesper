"""Periodic work owned by revenue-service.

The forecast is a batch job by design — it is refitted against the whole booking history,
not recomputed per booking. Nothing else triggers it, so without this the rate card shows
yesterday's view indefinitely and no rate cards are ever proposed.
"""
import logging
from uuid import UUID

from vesper_common.db import session_scope
from vesper_common.errors import VesperError
from vesper_common.scheduler import Scheduler, for_each_property

from . import service

log = logging.getLogger(__name__)


def _refresh_and_propose(property_id: str) -> None:
    """Refit, then price off the fresh numbers.

    Deliberately one job rather than two: proposing rate cards from a stale forecast is
    how a card ends up arguing for a price using last week's demand.
    """
    db = session_scope()
    try:
        forecasts = service.generate_forecast(db, UUID(property_id))
        log.info("refit the forecast: %s nights", len(forecasts))
        raised = service.propose_rate_cards(db, UUID(property_id))
        if raised:
            log.info("proposed %s rate card(s)", len(raised))
    except VesperError as exc:
        # Not enough booking history yet is an expected state, not a failure.
        log.info("skipped the forecast for %s: %s", property_id, exc)
    finally:
        db.close()


def build() -> Scheduler:
    scheduler = Scheduler("revenue-service")
    # Demand moves on the scale of days, and the fit reads a year of history, so nightly
    # is the right cadence. Twelve-hourly here so a demo running in the afternoon still
    # sees it happen once.
    scheduler.add("refit-forecast-and-propose-rates", 12 * 3600, for_each_property(_refresh_and_propose))
    return scheduler
