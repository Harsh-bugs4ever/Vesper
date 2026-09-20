"""The owner's dashboard, assembled in one call.

Six services own the numbers on this screen. Asking the browser to make six round trips
means six chances to half-render and six spinners; this fans out server-side instead,
where the calls are on the same network.

Two rules make it dependable:

  * the fan-out is parallel, so the page costs the slowest tile rather than the sum;
  * every tile degrades on its own. A maintenance outage blanks the maintenance tile and
    leaves the rest of the dashboard standing, because an owner checking occupancy at
    22:00 should not get an error page because a sensor service is restarting.

A tile that could not be loaded comes back as null with its name in `unavailable`, so the
UI can show a dash and say why rather than rendering a confident zero.
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from vesper_common.clients import (
    frontdesk,
    guest,
    guest_intel,
    inventory,
    maintenance,
    notification,
    property_client,
    revenue,
    staff,
)
from vesper_common.clock import utcnow
from vesper_common.events import bus

from . import service

log = logging.getLogger(__name__)

# Each tile is (name, callable). Anything that raises or returns None becomes a null
# tile rather than a failed request.
TIMEOUT_NOTE = "This service did not answer in time"


def build(db: Session, property_id: UUID, *, token: str | None, live_feed: int = 15) -> dict:
    """Assemble every tile. Never raises for a downstream failure."""
    pid = str(property_id)

    def occupancy() -> Any:
        return property_client.get("/property/occupancy", property_id=pid, token=token)

    def rooms() -> Any:
        board = property_client.get("/rooms/board", property_id=pid, token=token)
        return board.get("counts") if board else None

    def front_desk() -> Any:
        day = frontdesk.get("/bookings/today", property_id=pid, token=token)
        if day is None:
            return None
        return {
            "arrivals": len(day.get("arrivals", [])),
            "departures": len(day.get("departures", [])),
            "in_house": day.get("in_house_count", 0),
        }

    def requests() -> Any:
        open_requests = guest.get("/requests", property_id=pid, token=token)
        if open_requests is None:
            return None
        return {
            "open": len(open_requests),
            "overdue": sum(1 for r in open_requests if r.get("is_overdue")),
            "awaiting_accept": sum(1 for r in open_requests if r.get("status") == "raised"),
        }

    def tasks() -> Any:
        overdue = staff.get("/tasks/overdue", property_id=pid, token=token)
        return {"overdue": len(overdue)} if overdue is not None else None

    def stock() -> Any:
        return inventory.get("/inventory/summary", property_id=pid, token=token)

    def assets() -> Any:
        return maintenance.get("/maintenance/summary", property_id=pid, token=token)

    def sentiment() -> Any:
        return guest_intel.get(
            "/guest-intel/sentiment/summary", property_id=pid, token=token, params={"days": 30}
        )

    def at_risk() -> Any:
        guests = guest_intel.get("/guest-intel/at-risk", property_id=pid, token=token)
        return {"count": len(guests)} if guests is not None else None

    def forecast() -> Any:
        nights = revenue.get(
            "/revenue/forecast", property_id=pid, token=token, params={"days": 7}
        )
        if not nights:
            return None
        return {
            "nights": [
                {
                    "stay_date": n["stay_date"],
                    "predicted_occupancy": n["predicted_occupancy"],
                    "lower_bound": n["lower_bound"],
                    "upper_bound": n["upper_bound"],
                }
                for n in nights
            ],
            # Named so the dashboard never implies more rigour than was applied.
            "model": nights[0].get("model_name"),
            "confidence": nights[0].get("confidence"),
        }

    def outbox() -> Any:
        return notification.get("/notifications/outbox/summary", property_id=pid, token=token)

    tiles = {
        "occupancy": occupancy,
        "rooms": rooms,
        "front_desk": front_desk,
        "requests": requests,
        "tasks": tasks,
        "stock": stock,
        "assets": assets,
        "sentiment": sentiment,
        "at_risk_guests": at_risk,
        "forecast": forecast,
        "outbox": outbox,
    }

    results: dict[str, Any] = {}
    # One worker per tile: these are all I/O, and the page should cost the slowest call
    # rather than the sum of them.
    with ThreadPoolExecutor(max_workers=len(tiles)) as pool:
        futures = {name: pool.submit(fn) for name, fn in tiles.items()}
        for name, future in futures.items():
            try:
                results[name] = future.result()
            except Exception:
                log.warning("dashboard tile %r failed", name, exc_info=True)
                results[name] = None

    # These two are ours, read straight from the database rather than over HTTP.
    results["action_queue"] = service.stats_summary(db, property_id)
    results["engines"] = service.readiness(db, property_id)

    results["live_feed"] = [
        {
            "type": event.name,
            "payload": event.payload,
            "occurred_at": event.occurred_at,
            "id": event.id,
        }
        for event in bus.recent(live_feed)
        if event.property_id == pid
    ]

    unavailable = sorted(name for name in tiles if results.get(name) is None)
    results["unavailable"] = unavailable
    results["generated_at"] = utcnow().isoformat()
    if unavailable:
        log.info("dashboard served with %s unavailable", ", ".join(unavailable))
    return results
