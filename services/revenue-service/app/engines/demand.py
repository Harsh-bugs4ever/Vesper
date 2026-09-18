"""The demand engine.

Three layers, and the forecast says which one produced it:

  * `prophet`  — trend plus weekly and yearly seasonality, when Prophet is installed and
                 there is a year of history to fit it on.
  * `gradient` — XGBoost/LightGBM on calendar features, when they are installed.
  * `baseline` — day-of-week seasonal means with a linear trend. Pure Python, always
                 available, and genuinely reasonable for hotel occupancy, which is
                 mostly "what does a Saturday in November look like here".

The fallback is not a placeholder for a real model — a resort with four months of data
does not have enough signal for anything heavier, and a baseline that is honest about
its interval beats a gradient booster that is confidently wrong.
"""
from __future__ import annotations

import logging
import math
import statistics
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta

log = logging.getLogger(__name__)

# Below this, day-of-week means are noise and we widen the interval to say so.
MIN_HISTORY_DAYS = 28
PROPHET_MIN_DAYS = 365
GRADIENT_MIN_DAYS = 90

# Indian holiday and season effects a Mumbai beach resort actually feels. Demo-grade:
# a real deployment reads a holiday calendar, and that is on the backlog.
SEASON_MULTIPLIERS = {
    1: 1.10, 2: 1.08, 3: 1.00, 4: 0.95, 5: 0.92, 6: 0.80,
    7: 0.78, 8: 0.82, 9: 0.90, 10: 1.05, 11: 1.12, 12: 1.20,
}


@dataclass(slots=True)
class Observation:
    day: date
    occupancy: float
    adr: float


@dataclass(slots=True)
class Prediction:
    day: date
    occupancy: float
    lower: float
    upper: float
    adr: float
    confidence: float
    model: str
    features: dict


def forecast(
    history: Sequence[Observation],
    horizon_days: int = 30,
    *,
    start: date | None = None,
) -> list[Prediction]:
    """Predict occupancy for `horizon_days` nights from `start` (default: tomorrow).

    `start` is explicit because anchoring to the end of the history is wrong here. The
    series already contains future nights — rooms sold weeks ahead are occupied nights,
    not predictions — so anchoring to its last date skips the near-term dates the rate
    card actually prices.
    """
    if not history:
        return []

    ordered = sorted(history, key=lambda o: o.day)
    first = start or (ordered[-1].day + timedelta(days=1))

    if len(ordered) >= PROPHET_MIN_DAYS:
        predictions = _try_prophet(ordered, horizon_days, first)
        if predictions:
            return predictions
    if len(ordered) >= GRADIENT_MIN_DAYS:
        predictions = _try_gradient(ordered, horizon_days, first)
        if predictions:
            return predictions
    return _baseline(ordered, horizon_days, first)


# --- baseline ---------------------------------------------------------------------


def _baseline(history: list[Observation], horizon_days: int, start: date) -> list[Prediction]:
    """Day-of-week means, a linear trend and a month multiplier.

    The interval comes from the observed spread within each weekday rather than a fixed
    percentage, so a resort with erratic Tuesdays gets a visibly wider Tuesday band.
    """
    by_weekday: dict[int, list[float]] = {}
    for observation in history:
        by_weekday.setdefault(observation.day.weekday(), []).append(observation.occupancy)

    overall_mean = statistics.fmean(o.occupancy for o in history)
    slope = _trend_slope([o.occupancy for o in history])
    recent_adr = statistics.fmean([o.adr for o in history[-30:]] or [0.0])
    sample_size = len(history)

    predictions: list[Prediction] = []
    for step in range(1, horizon_days + 1):
        target = start + timedelta(days=step - 1)
        weekday_values = by_weekday.get(target.weekday(), [])
        weekday_mean = statistics.fmean(weekday_values) if weekday_values else overall_mean
        spread = statistics.pstdev(weekday_values) if len(weekday_values) > 2 else overall_mean * 0.15

        seasonal = SEASON_MULTIPLIERS.get(target.month, 1.0)
        trend = slope * step
        point = _clamp(weekday_mean * seasonal + trend)

        # Uncertainty grows with how far out we are looking — a Saturday three weeks
        # away is a guess in a way that tomorrow is not.
        widening = 1.0 + (step / horizon_days) * 0.8
        margin = min(0.35, spread * 1.96 * widening)

        confidence = _confidence(sample_size, len(weekday_values), step, horizon_days)
        predictions.append(
            Prediction(
                day=target,
                occupancy=round(point, 4),
                lower=round(_clamp(point - margin), 4),
                upper=round(_clamp(point + margin), 4),
                adr=round(recent_adr * seasonal, 2),
                confidence=round(confidence, 4),
                model="baseline",
                features={
                    "weekday_mean": round(weekday_mean, 4),
                    "season_multiplier": seasonal,
                    "trend_per_day": round(slope, 6),
                    "weekday_samples": len(weekday_values),
                    "is_weekend": target.weekday() >= 4,
                },
            )
        )
    return predictions


def _trend_slope(values: list[float]) -> float:
    """Least-squares slope per day. Flat when there is too little to fit."""
    n = len(values)
    if n < MIN_HISTORY_DAYS:
        return 0.0
    mean_x = (n - 1) / 2
    mean_y = statistics.fmean(values)
    numerator = sum((i - mean_x) * (v - mean_y) for i, v in enumerate(values))
    denominator = sum((i - mean_x) ** 2 for i in range(n))
    if denominator == 0:
        return 0.0
    # Cap it: extrapolating a steep short-run trend 30 days out produces occupancy
    # above 100% or below zero, which is worse than saying "about the same".
    return max(-0.002, min(0.002, numerator / denominator))


# A day-of-week mean with a linear trend is a reasonable forecast, not an authoritative
# one. Capping it well below certainty keeps the pricing page honest: a card claiming
# 99% confidence off a baseline with a 20-point interval invites a decision the method
# cannot support. Prophet and the gradient model report their own, higher, ceilings.
BASELINE_MAX_CONFIDENCE = 0.72


def _confidence(sample_size: int, weekday_samples: int, step: int, horizon: int) -> float:
    """How much to trust this number, before the action queue scales it again."""
    history_factor = min(1.0, sample_size / 180)
    weekday_factor = min(1.0, weekday_samples / 12)
    evidence = 0.35 + 0.4 * history_factor + 0.25 * weekday_factor
    distance_penalty = 1.0 - 0.35 * (step / horizon)
    return max(0.15, min(BASELINE_MAX_CONFIDENCE, evidence) * distance_penalty)


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


# --- optional heavier models -------------------------------------------------------


def _try_prophet(history: list[Observation], horizon_days: int, start: date) -> list[Prediction] | None:
    try:
        import pandas as pd
        from prophet import Prophet
    except ImportError:
        return None

    try:
        frame = pd.DataFrame(
            {"ds": [o.day for o in history], "y": [o.occupancy for o in history]}
        )
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            interval_width=0.8,
        )
        model.fit(frame)
        # Project far enough to cover the window even when it starts before the end of
        # the history, then keep only the nights asked for.
        wanted = {start + timedelta(days=i) for i in range(horizon_days)}
        reach = max(horizon_days, (max(wanted) - history[-1].day).days + 1)
        future = model.make_future_dataframe(periods=max(reach, 1))
        predicted = model.predict(future)
        result = predicted[predicted["ds"].dt.date.isin(wanted)]
    except Exception:
        # A fit that blows up must not take the pricing page down with it.
        log.exception("Prophet fit failed; falling back to the baseline")
        return None

    recent_adr = statistics.fmean([o.adr for o in history[-30:]] or [0.0])
    predictions: list[Prediction] = []
    for _, row in result.iterrows():
        day = row["ds"].date()
        seasonal = SEASON_MULTIPLIERS.get(day.month, 1.0)
        predictions.append(
            Prediction(
                day=day,
                occupancy=round(_clamp(float(row["yhat"])), 4),
                lower=round(_clamp(float(row["yhat_lower"])), 4),
                upper=round(_clamp(float(row["yhat_upper"])), 4),
                adr=round(recent_adr * seasonal, 2),
                confidence=0.78,
                model="prophet",
                features={"trend": round(float(row.get("trend", 0.0)), 4)},
            )
        )
    return predictions


def _try_gradient(history: list[Observation], horizon_days: int, start: date) -> list[Prediction] | None:
    """Gradient boosting on calendar features.

    Tree models cannot extrapolate a trend, so this is only used when there is enough
    history for the seasonal pattern itself to carry the signal.
    """
    try:
        import numpy as np
        from xgboost import XGBRegressor
    except ImportError:
        return None

    try:
        features = np.array([_calendar_features(o.day) for o in history])
        targets = np.array([o.occupancy for o in history])
        model = XGBRegressor(
            n_estimators=220, max_depth=4, learning_rate=0.06, subsample=0.9, verbosity=0
        )
        model.fit(features, targets)

        residuals = targets - model.predict(features)
        spread = float(np.std(residuals))

        future_days = [start + timedelta(days=s) for s in range(horizon_days)]
        future_features = np.array([_calendar_features(d) for d in future_days])
        points = model.predict(future_features)
    except Exception:
        log.exception("Gradient model failed; falling back")
        return None

    recent_adr = statistics.fmean([o.adr for o in history[-30:]] or [0.0])
    predictions: list[Prediction] = []
    for step, (day, point) in enumerate(zip(future_days, points, strict=True), start=1):
        seasonal = SEASON_MULTIPLIERS.get(day.month, 1.0)
        margin = min(0.35, spread * 1.96 * (1.0 + step / horizon_days * 0.6))
        predictions.append(
            Prediction(
                day=day,
                occupancy=round(_clamp(float(point)), 4),
                lower=round(_clamp(float(point) - margin), 4),
                upper=round(_clamp(float(point) + margin), 4),
                adr=round(recent_adr * seasonal, 2),
                confidence=round(max(0.3, 0.72 - 0.2 * (step / horizon_days)), 4),
                model="gradient",
                features={"residual_sd": round(spread, 4), "is_weekend": day.weekday() >= 4},
            )
        )
    return predictions


def _calendar_features(day: date) -> list[float]:
    """What a tree model can actually use: cyclical time, not raw ordinals."""
    day_of_year = day.timetuple().tm_yday
    return [
        day.weekday(),
        float(day.weekday() >= 4),
        day.month,
        day.day,
        math.sin(2 * math.pi * day_of_year / 365.25),
        math.cos(2 * math.pi * day_of_year / 365.25),
        SEASON_MULTIPLIERS.get(day.month, 1.0),
    ]


# --- pricing ----------------------------------------------------------------------


def suggest_rate(
    *, base_rate: float, prediction: Prediction, competitor_median: float | None
) -> tuple[float, list[dict]]:
    """Turn a demand forecast into a price, and say why.

    Three pulls: how full we expect to be, where the comp set sits, and whether it is a
    weekend. Each returns a multiplier and a sentence the card can show.
    """
    drivers: list[dict] = []
    multiplier = 1.0

    occupancy = prediction.occupancy
    if occupancy >= 0.90:
        demand_pull, label = 1.18, "very high"
    elif occupancy >= 0.80:
        demand_pull, label = 1.10, "high"
    elif occupancy >= 0.65:
        demand_pull, label = 1.0, "healthy"
    elif occupancy >= 0.45:
        demand_pull, label = 0.94, "soft"
    else:
        demand_pull, label = 0.88, "weak"
    multiplier *= demand_pull
    drivers.append(
        {
            "label": "Forecast demand",
            "detail": f"{occupancy:.0%} occupancy expected — {label} "
            f"(range {prediction.lower:.0%}–{prediction.upper:.0%})",
            "weight": 0.5,
        }
    )

    if competitor_median:
        gap = (competitor_median - base_rate) / base_rate
        if gap > 0.08:
            multiplier *= 1.05
            drivers.append(
                {
                    "label": "Comp set is higher",
                    "detail": f"Nearby hotels average ₹{competitor_median:,.0f}, "
                    f"{gap:.0%} above our base rate",
                    "weight": 0.3,
                }
            )
        elif gap < -0.08:
            multiplier *= 0.96
            drivers.append(
                {
                    "label": "Comp set is lower",
                    "detail": f"Nearby hotels average ₹{competitor_median:,.0f}, "
                    f"{abs(gap):.0%} below our base rate",
                    "weight": 0.3,
                }
            )

    if prediction.day.weekday() >= 4:
        multiplier *= 1.04
        drivers.append(
            {"label": "Weekend", "detail": f"{prediction.day:%A} night", "weight": 0.2}
        )

    # Never move a published rate by more than 25% in one decision. A bigger move than
    # that is a strategy conversation, not a card somebody approves between meetings.
    multiplier = max(0.75, min(1.25, multiplier))
    return round(base_rate * multiplier, -1), drivers
