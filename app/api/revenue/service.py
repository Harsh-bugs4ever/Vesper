"""Forecasting, per-date rate execution with safe revert, and the what-if simulator."""
from __future__ import annotations

import logging
import statistics
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from vesper_common.clients import action, frontdesk, property_client
from vesper_common.clock import local_today, utcnow
from vesper_common.errors import Invalid, NotFound
from vesper_common.permissions import Perm

from .engines import demand
from .engines.demand import Observation
from .models import Competitor, CompetitorRate, DailyRate, DemandForecast, RateHistory, RateSource

log = logging.getLogger(__name__)

FORECAST_HORIZON_DAYS = 30
# A rate card is only worth raising if the money involved justifies a manager's attention.
MIN_CARD_IMPACT = Decimal("15000")


# --- forecasting ------------------------------------------------------------------


def _history(property_id: UUID, total_rooms: int) -> list[Observation]:
    """Nightly occupancy, read from front desk rather than our own tables."""
    rows = frontdesk.get(
        "/bookings/occupancy-history", property_id=property_id, params={"days": 365}
    )
    if not rows or not total_rooms:
        return []
    return [
        Observation(
            day=date.fromisoformat(row["date"]),
            occupancy=min(1.0, row["bookings"] / total_rooms),
            adr=float(row["average_rate"]),
        )
        for row in rows
    ]


def generate_forecast(db: Session, property_id: UUID, *, horizon: int = FORECAST_HORIZON_DAYS) -> list[DemandForecast]:
    """Refit and store the next month of nights.

    Forecasts are upserted per date so the pricing page always reads one row per night,
    however many times the engine has run today.
    """
    occupancy = property_client.get("/property/occupancy", property_id=property_id) or {}
    total_rooms = int(occupancy.get("total_rooms") or 0)
    history = _history(property_id, total_rooms)
    if not history:
        raise Invalid("Not enough booking history to forecast yet")

    # Anchored to tomorrow, not to the end of the history: nights already sold are
    # occupancy, and the rate card prices the fortnight starting now.
    predictions = demand.forecast(
        history, horizon_days=horizon, start=local_today() + timedelta(days=1)
    )
    now = utcnow()
    stored: list[DemandForecast] = []
    for prediction in predictions:
        row = db.scalars(
            select(DemandForecast).where(
                DemandForecast.property_id == property_id,
                DemandForecast.stay_date == prediction.day,
            )
        ).first()
        if row is None:
            row = DemandForecast(property_id=property_id, stay_date=prediction.day)
            db.add(row)
        row.predicted_occupancy = prediction.occupancy
        row.lower_bound = prediction.lower
        row.upper_bound = prediction.upper
        row.predicted_adr = Decimal(str(prediction.adr))
        row.confidence = prediction.confidence
        row.model_name = prediction.model
        row.features = prediction.features
        row.generated_at = now
        stored.append(row)

    db.commit()
    log.info("forecast refreshed for %s using %s", property_id, predictions[0].model)
    return stored


def list_forecast(db: Session, property_id: UUID, *, days: int = FORECAST_HORIZON_DAYS) -> list[DemandForecast]:
    today = local_today()
    query = (
        select(DemandForecast)
        .where(
            DemandForecast.property_id == property_id,
            DemandForecast.stay_date >= today,
            DemandForecast.stay_date <= today + timedelta(days=days),
        )
        .order_by(DemandForecast.stay_date)
    )
    return list(db.scalars(query))


# --- rates ------------------------------------------------------------------------


def rate_for(db: Session, property_id: UUID, category_id: UUID, stay_date: date) -> DailyRate | None:
    query = select(DailyRate).where(
        DailyRate.property_id == property_id,
        DailyRate.room_category_id == category_id,
        DailyRate.stay_date == stay_date,
    )
    return db.scalars(query).first()


def rate_card(db: Session, property_id: UUID, *, days: int = FORECAST_HORIZON_DAYS) -> list[dict]:
    """The pricing grid: every category, every night, with the forecast beside it."""
    today = local_today()
    end = today + timedelta(days=days)
    categories = property_client.get("/property/room-categories", property_id=property_id) or []
    forecasts = {f.stay_date: f for f in list_forecast(db, property_id, days=days)}

    rows = db.scalars(
        select(DailyRate).where(
            DailyRate.property_id == property_id,
            DailyRate.stay_date >= today,
            DailyRate.stay_date <= end,
        )
    ).all()
    stored = {(r.room_category_id, r.stay_date): r for r in rows}

    card: list[dict] = []
    for category in categories:
        category_id = UUID(category["id"])
        base = Decimal(str(category["base_rate"]))
        nights = []
        for offset in range((end - today).days + 1):
            stay_date = today + timedelta(days=offset)
            row = stored.get((category_id, stay_date))
            forecast_row = forecasts.get(stay_date)
            nights.append(
                {
                    "stay_date": stay_date.isoformat(),
                    "rate": float(row.rate if row else base),
                    "is_override": row is not None and row.source != RateSource.BASE,
                    "source": row.source if row else RateSource.BASE.value,
                    "predicted_occupancy": forecast_row.predicted_occupancy if forecast_row else None,
                    "confidence": forecast_row.confidence if forecast_row else None,
                }
            )
        card.append(
            {
                "room_category_id": str(category_id),
                "name": category["name"],
                "base_rate": float(base),
                "nights": nights,
            }
        )
    return card


def apply_rates(
    db: Session,
    property_id: UUID,
    *,
    room_category_id: UUID,
    dates: list[date],
    rate: Decimal,
    source: str,
    source_card_id: UUID | None = None,
    changed_by: UUID | None = None,
) -> dict:
    """Set one price across specific dates, capturing what was there before.

    The returned `previous_rates` is what undo replays. It records the base rate
    explicitly when no override existed, so reverting removes the override rather than
    writing today's base rate as a permanent one.
    """
    if not dates:
        raise Invalid("Pick at least one date to reprice")
    if rate <= 0:
        raise Invalid("A rate must be greater than zero")

    categories = property_client.get("/property/room-categories", property_id=property_id) or []
    category = next((c for c in categories if c["id"] == str(room_category_id)), None)
    if category is None:
        raise NotFound("Room category not found")

    previous: list[dict] = []
    for stay_date in dates:
        row = rate_for(db, property_id, room_category_id, stay_date)
        previous.append(
            {
                "room_category_id": str(room_category_id),
                "stay_date": stay_date.isoformat(),
                # None means "there was no override here" — undo deletes the row.
                "rate": float(row.rate) if row else None,
                "source": row.source if row else None,
            }
        )
        if row is None:
            row = DailyRate(
                property_id=property_id,
                room_category_id=room_category_id,
                stay_date=stay_date,
            )
            db.add(row)
        before = row.rate if row.id else None
        row.rate = rate
        row.source = source
        row.source_card_id = source_card_id
        row.changed_by = changed_by
        db.add(
            RateHistory(
                property_id=property_id,
                room_category_id=room_category_id,
                stay_date=stay_date,
                previous_rate=before,
                new_rate=rate,
                source=source,
                source_card_id=source_card_id,
                changed_by=changed_by,
            )
        )

    db.commit()
    return {
        "room_category_id": str(room_category_id),
        "applied_dates": [d.isoformat() for d in dates],
        "rate": float(rate),
        "previous_rates": previous,
    }


def restore_rates(db: Session, property_id: UUID, previous: list[dict], source_card_id: UUID | None) -> dict:
    """Undo: put each date back exactly as it was, including back to no override."""
    restored = 0
    for entry in previous:
        category_id = UUID(entry["room_category_id"])
        stay_date = date.fromisoformat(entry["stay_date"])
        row = rate_for(db, property_id, category_id, stay_date)
        if entry.get("rate") is None:
            if row is not None:
                db.add(
                    RateHistory(
                        property_id=property_id,
                        room_category_id=category_id,
                        stay_date=stay_date,
                        previous_rate=row.rate,
                        new_rate=row.rate,
                        source=RateSource.REVERT,
                        source_card_id=source_card_id,
                    )
                )
                db.delete(row)
                restored += 1
            continue

        old_rate = Decimal(str(entry["rate"]))
        if row is None:
            row = DailyRate(
                property_id=property_id, room_category_id=category_id, stay_date=stay_date
            )
            db.add(row)
        db.add(
            RateHistory(
                property_id=property_id,
                room_category_id=category_id,
                stay_date=stay_date,
                previous_rate=row.rate if row.id else None,
                new_rate=old_rate,
                source=RateSource.REVERT,
                source_card_id=source_card_id,
            )
        )
        row.rate = old_rate
        row.source = entry.get("source") or RateSource.MANUAL
        restored += 1

    db.commit()
    return {"restored": restored}


def rate_history(db: Session, property_id: UUID, *, category_id: UUID | None = None, limit: int = 200) -> list[RateHistory]:
    query = select(RateHistory).where(RateHistory.property_id == property_id)
    if category_id:
        query = query.where(RateHistory.room_category_id == category_id)
    return list(db.scalars(query.order_by(RateHistory.created_at.desc()).limit(limit)))


# --- competitors ------------------------------------------------------------------


def competitor_table(db: Session, property_id: UUID, *, days: int = 14) -> list[dict]:
    today = local_today()
    end = today + timedelta(days=days)
    competitors = db.scalars(
        select(Competitor).where(Competitor.property_id == property_id).order_by(Competitor.distance_km)
    ).all()
    rates = db.scalars(
        select(CompetitorRate).where(
            CompetitorRate.property_id == property_id,
            CompetitorRate.stay_date >= today,
            CompetitorRate.stay_date <= end,
        )
    ).all()

    by_competitor: dict[UUID, dict[str, float]] = {}
    for row in rates:
        by_competitor.setdefault(row.competitor_id, {})[row.stay_date.isoformat()] = float(row.rate)

    return [
        {
            "id": str(c.id),
            "name": c.name,
            "distance_km": c.distance_km,
            "star_rating": c.star_rating,
            "rates": by_competitor.get(c.id, {}),
        }
        for c in competitors
    ]


def competitor_median(db: Session, property_id: UUID, stay_date: date) -> float | None:
    rows = db.scalars(
        select(CompetitorRate).where(
            CompetitorRate.property_id == property_id, CompetitorRate.stay_date == stay_date
        )
    ).all()
    if not rows:
        return None
    return float(statistics.median(float(r.rate) for r in rows))


# --- raising rate cards -----------------------------------------------------------


def propose_rate_cards(db: Session, property_id: UUID, *, days: int = 14) -> list[dict]:
    """Look at the next fortnight and raise a card wherever the price looks wrong.

    One card per category per night would drown the queue, so nights that want the same
    move are grouped into a single card covering a date range.
    """
    categories = property_client.get("/property/room-categories", property_id=property_id) or []
    occupancy = property_client.get("/property/occupancy", property_id=property_id) or {}
    total_rooms = int(occupancy.get("total_rooms") or 0)
    forecasts = {f.stay_date: f for f in list_forecast(db, property_id, days=days)}
    raised: list[dict] = []

    for category in categories:
        category_id = UUID(category["id"])
        base = float(category["base_rate"])
        # Rooms in this category, used to turn a rate delta into a rupee figure.
        category_rooms = max(1, total_rooms // max(1, len(categories)))

        groups: dict[float, list] = {}
        for stay_date, forecast_row in sorted(forecasts.items()):
            current = rate_for(db, property_id, category_id, stay_date)
            current_rate = float(current.rate) if current else base
            prediction = demand.Prediction(
                day=stay_date,
                occupancy=forecast_row.predicted_occupancy,
                lower=forecast_row.lower_bound,
                upper=forecast_row.upper_bound,
                adr=float(forecast_row.predicted_adr),
                confidence=forecast_row.confidence,
                model=forecast_row.model_name,
                features=forecast_row.features,
            )
            suggested, drivers = demand.suggest_rate(
                base_rate=base,
                prediction=prediction,
                competitor_median=competitor_median(db, property_id, stay_date),
            )
            # Ignore rounding-scale differences; a ₹200 move is not a decision.
            if abs(suggested - current_rate) / max(current_rate, 1) < 0.03:
                continue
            groups.setdefault(suggested, []).append((stay_date, forecast_row, drivers, current_rate))

        for suggested, entries in groups.items():
            dates = [e[0] for e in entries]
            current_rate = entries[0][3]
            drivers = entries[0][2]
            expected_rooms = sum(e[1].predicted_occupancy for e in entries) * category_rooms
            impact = Decimal(str(round((suggested - current_rate) * expected_rooms, 2)))
            if abs(impact) < MIN_CARD_IMPACT:
                continue

            direction = "Raise" if suggested > current_rate else "Lower"
            card = {
                "engine": "revenue",
                "kind": "rate_change",
                "title": f"{direction} {category['name']} to ₹{suggested:,.0f} for {len(dates)} night(s)",
                "summary": (
                    f"{category['name']} is at ₹{current_rate:,.0f}. The demand forecast for "
                    f"{dates[0]:%d %b}"
                    + (f"–{dates[-1]:%d %b}" if len(dates) > 1 else "")
                    + f" supports ₹{suggested:,.0f}."
                ),
                "required_permission": Perm.RATES_APPROVE.value,
                "drivers": drivers,
                "confidence": round(statistics.fmean(e[1].confidence for e in entries), 4),
                "impact_amount": float(impact),
                "urgency": "high" if (dates[0] - local_today()).days <= 3 else "medium",
                "payload": {
                    "room_category_id": str(category_id),
                    "dates": [d.isoformat() for d in dates],
                    "rate": suggested,
                    "current_rate": current_rate,
                    # A manager may retune the price, not the nights it applies to.
                    "editable_fields": ["rate", "impact_amount"],
                },
                # A card for next Saturday is worthless the Sunday after.
                "expires_at": (
                    utcnow() + timedelta(days=max(1, (dates[0] - local_today()).days))
                ).isoformat(),
                "dedupe_key": f"rate:{category_id}:{dates[0].isoformat()}",
            }
            if action.post("/cards", property_id=property_id, json=card) is not None:
                raised.append(card)

    return raised


# --- simulator --------------------------------------------------------------------


def simulate(db: Session, property_id: UUID, *, rate_change_pct: float, staffing_change_pct: float, promo_discount_pct: float, days: int = 30) -> dict:
    """What-if on live data, for the owner's slider page.

    A deliberately simple elasticity model, and the response says so: the point is to
    show the shape of a trade-off, not to promise a number to two decimal places.
    """
    forecasts = list_forecast(db, property_id, days=days)
    if not forecasts:
        raise Invalid("Generate a forecast before running a simulation")

    occupancy = property_client.get("/property/occupancy", property_id=property_id) or {}
    total_rooms = int(occupancy.get("total_rooms") or 0) or 1

    # Hotel demand is price-elastic but not violently so: a 10% rate rise typically
    # costs a few points of occupancy, not a collapse.
    price_elasticity = -0.55
    effective_rate_change = rate_change_pct - promo_discount_pct

    baseline_revenue = 0.0
    simulated_revenue = 0.0
    nights: list[dict] = []
    for row in forecasts:
        base_occ = row.predicted_occupancy
        base_adr = float(row.predicted_adr) or 0.0

        occupancy_shift = price_elasticity * (effective_rate_change / 100)
        new_occ = max(0.0, min(1.0, base_occ * (1 + occupancy_shift)))
        new_adr = base_adr * (1 + effective_rate_change / 100)

        base_night = base_occ * total_rooms * base_adr
        new_night = new_occ * total_rooms * new_adr
        baseline_revenue += base_night
        simulated_revenue += new_night
        nights.append(
            {
                "stay_date": row.stay_date.isoformat(),
                "baseline_occupancy": round(base_occ, 4),
                "simulated_occupancy": round(new_occ, 4),
                "baseline_revenue": round(base_night, 2),
                "simulated_revenue": round(new_night, 2),
            }
        )

    # Staffing changes cost money and, past a point, service quality. Modelled as a
    # straight cost delta against an assumed average shift cost.
    average_daily_labour_cost = total_rooms * 900
    labour_delta = average_daily_labour_cost * (staffing_change_pct / 100) * len(forecasts)

    return {
        "days": len(forecasts),
        "baseline_revenue": round(baseline_revenue, 2),
        "simulated_revenue": round(simulated_revenue, 2),
        "revenue_delta": round(simulated_revenue - baseline_revenue, 2),
        "labour_cost_delta": round(labour_delta, 2),
        "net_delta": round(simulated_revenue - baseline_revenue - labour_delta, 2),
        "assumptions": {
            "price_elasticity": price_elasticity,
            "average_daily_labour_cost": average_daily_labour_cost,
            "note": "Elasticity is a flat demo assumption, not a fitted parameter.",
        },
        "nights": nights,
    }
