"""The demand engine's guarantees, independent of which model produced the numbers.

These run against whichever tier is installed. The assertions are properties that must
hold for any of them, which is the point: the pricing page cannot care whether Prophet
was available.
"""
from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(SERVICE_ROOT.parents[1] / "packages" / "py-common"))

from app.engines import demand  # noqa: E402
from app.engines.demand import Observation, Prediction  # noqa: E402


def make_history(days: int = 120, *, weekend_lift: float = 0.2) -> list[Observation]:
    """A year-ish of plausible occupancy: a weekday baseline with a weekend lift."""
    start = date(2026, 1, 1)
    history = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        base = 0.62 + (weekend_lift if day.weekday() >= 4 else 0.0)
        # Deterministic wobble, so the test never flakes.
        wobble = 0.03 * ((offset % 7) - 3) / 3
        history.append(Observation(day=day, occupancy=base + wobble, adr=11000 + offset))
    return history


def test_returns_one_prediction_per_requested_night():
    predictions = demand.forecast(make_history(), horizon_days=30)
    assert len(predictions) == 30
    days = [p.day for p in predictions]
    assert days == sorted(days), "predictions must come back in date order"
    assert len(set(days)) == 30, "no duplicate nights"


def test_occupancy_and_bounds_stay_in_range():
    """Occupancy is a fraction. A forecast of 130% full is meaningless on a rate card."""
    for prediction in demand.forecast(make_history(), horizon_days=30):
        assert 0.0 <= prediction.occupancy <= 1.0
        assert 0.0 <= prediction.lower <= 1.0
        assert 0.0 <= prediction.upper <= 1.0
        assert prediction.lower <= prediction.occupancy <= prediction.upper


def test_confidence_decays_with_distance():
    """Tomorrow is knowable in a way that a month out is not."""
    predictions = demand.forecast(make_history(), horizon_days=30)
    assert predictions[0].confidence > predictions[-1].confidence


def test_interval_widens_with_distance():
    predictions = demand.forecast(make_history(), horizon_days=30)
    near = predictions[0].upper - predictions[0].lower
    far = predictions[-1].upper - predictions[-1].lower
    assert far >= near


def test_weekend_reads_busier_than_midweek():
    """The signal that actually matters for pricing."""
    predictions = demand.forecast(make_history(weekend_lift=0.25), horizon_days=28)
    weekend = [p.occupancy for p in predictions if p.day.weekday() >= 4]
    midweek = [p.occupancy for p in predictions if p.day.weekday() < 4]
    assert sum(weekend) / len(weekend) > sum(midweek) / len(midweek)


def test_every_prediction_names_its_model():
    """The UI states which engine ran; it must never have to guess."""
    for prediction in demand.forecast(make_history(), horizon_days=7):
        assert prediction.model in {"baseline", "gradient", "prophet"}


def test_empty_history_forecasts_nothing():
    assert demand.forecast([], horizon_days=30) == []


def test_short_history_still_produces_a_forecast():
    """A resort three weeks into using Vesper still needs a rate card."""
    predictions = demand.forecast(make_history(days=10), horizon_days=7)
    assert len(predictions) == 7
    # With this little data the trend is deliberately flattened rather than extrapolated.
    assert predictions[0].features.get("trend_per_day") == 0.0


# --- pricing ----------------------------------------------------------------------


def _prediction(occupancy: float, day: date | None = None) -> Prediction:
    return Prediction(
        day=day or date(2026, 3, 4),  # a Wednesday, so no weekend multiplier
        occupancy=occupancy,
        lower=max(0.0, occupancy - 0.08),
        upper=min(1.0, occupancy + 0.08),
        adr=12000,
        confidence=0.7,
        model="baseline",
        features={},
    )


def test_high_demand_raises_the_rate_and_says_why():
    rate, drivers = demand.suggest_rate(
        base_rate=10000, prediction=_prediction(0.94), competitor_median=None
    )
    assert rate > 10000
    assert any("demand" in d["label"].lower() for d in drivers)


def test_weak_demand_lowers_the_rate():
    rate, _ = demand.suggest_rate(
        base_rate=10000, prediction=_prediction(0.30), competitor_median=None
    )
    assert rate < 10000


def test_rate_never_moves_more_than_25_percent():
    """A bigger move than this is a strategy decision, not a card to approve between
    meetings."""
    for occupancy in (0.0, 0.05, 0.5, 0.99, 1.0):
        for competitor in (None, 3000, 60000):
            rate, _ = demand.suggest_rate(
                base_rate=10000,
                prediction=_prediction(occupancy),
                competitor_median=competitor,
            )
            assert 7500 <= rate <= 12500, f"{occupancy=} {competitor=} produced {rate}"


def test_competitor_set_moves_the_price_both_ways():
    high, high_drivers = demand.suggest_rate(
        base_rate=10000, prediction=_prediction(0.7), competitor_median=13000
    )
    low, _ = demand.suggest_rate(
        base_rate=10000, prediction=_prediction(0.7), competitor_median=7000
    )
    assert high > low
    assert any("comp set" in d["label"].lower() for d in high_drivers)


def test_weekend_adds_a_driver():
    saturday = date(2026, 3, 7)
    assert saturday.weekday() == 5
    _, drivers = demand.suggest_rate(
        base_rate=10000, prediction=_prediction(0.7, saturday), competitor_median=None
    )
    assert any(d["label"] == "Weekend" for d in drivers)


def test_drivers_are_renderable():
    """Every driver is a line on the card, so each needs all three fields."""
    _, drivers = demand.suggest_rate(
        base_rate=10000, prediction=_prediction(0.92), competitor_median=14000
    )
    assert drivers
    for driver in drivers:
        assert driver["label"] and driver["detail"]
        assert 0.0 <= driver["weight"] <= 1.0


@pytest.mark.parametrize("occupancy", [0.0, 0.25, 0.5, 0.75, 1.0])
def test_suggested_rate_is_always_positive(occupancy):
    rate, _ = demand.suggest_rate(
        base_rate=10000, prediction=_prediction(occupancy), competitor_median=None
    )
    assert rate > 0


def test_forecast_starts_where_it_is_told_not_where_history_ends():
    """Nights already sold are occupancy, not predictions.

    Anchoring to the end of the series skipped the near-term dates the rate card prices,
    because the history contains bookings weeks ahead.
    """
    history = make_history(days=120)
    last_historical = history[-1].day
    start = last_historical - timedelta(days=10)

    predictions = demand.forecast(history, horizon_days=14, start=start)
    assert predictions[0].day == start
    assert len(predictions) == 14
    assert predictions[-1].day == start + timedelta(days=13)


def test_forecast_defaults_to_the_day_after_the_history():
    history = make_history(days=60)
    predictions = demand.forecast(history, horizon_days=5)
    assert predictions[0].day == history[-1].day + timedelta(days=1)


def test_baseline_confidence_is_capped_below_certainty():
    """A day-of-week mean with a 20-point band must not claim 99%."""
    for prediction in demand.forecast(make_history(days=365), horizon_days=30):
        if prediction.model == "baseline":
            assert prediction.confidence <= demand.BASELINE_MAX_CONFIDENCE
