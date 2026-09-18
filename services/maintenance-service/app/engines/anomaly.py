"""Anomaly detection and failure risk for physical assets.

Two questions, deliberately kept apart:

  * "Is this reading strange?"  — anomaly detection over a recent sensor window.
  * "Is this machine likely to fail soon?" — a risk score combining anomaly rate,
    service overdue-ness, age, criticality and how often it has been reported broken.

Isolation Forest is used when scikit-learn is available and there is enough history.
Otherwise a robust z-score on the median and MAD does the job — for a single sensor
channel on a chiller it is close to equivalent, and it cannot silently mis-fit.
"""
from __future__ import annotations

import logging
import statistics
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime

log = logging.getLogger(__name__)

# Below this many points, "unusual" is not a meaningful statement.
MIN_POINTS = 20
ISOLATION_FOREST_MIN_POINTS = 120

# A robust z-score above this is flagged. 3.5 on MAD is the conventional threshold and
# is noticeably less trigger-happy than a mean/standard-deviation equivalent, which one
# bad spike drags upward.
ROBUST_Z_THRESHOLD = 3.5
# Scale factor making MAD a consistent estimator of sigma for normal data.
MAD_TO_SIGMA = 1.4826
# Spread below this fraction of the signal's own magnitude is treated as no spread at
# all. Detrending a clean linear series leaves residuals of around 1e-16; without this
# floor, that floating-point noise is divided by itself and every reading looks like a
# massive outlier.
RELATIVE_NOISE_FLOOR = 1e-6


@dataclass(slots=True)
class Reading:
    recorded_at: datetime
    value: float


@dataclass(slots=True)
class Anomaly:
    recorded_at: datetime
    value: float
    score: float
    reason: str


@dataclass(slots=True)
class RiskAssessment:
    risk_score: float
    confidence: float
    drivers: list[dict]
    method: str
    anomaly_count: int
    trend_per_day: float


def detect(readings: Sequence[Reading]) -> tuple[list[Anomaly], str]:
    """Find readings that do not belong. Returns the anomalies and the method used."""
    if len(readings) < MIN_POINTS:
        return [], "insufficient_data"
    ordered = sorted(readings, key=lambda r: r.recorded_at)
    if len(ordered) >= ISOLATION_FOREST_MIN_POINTS:
        found = _isolation_forest(ordered)
        if found is not None:
            return found, "isolation_forest"
    return _robust_z(ordered), "robust_z"


def _robust_z(readings: list[Reading]) -> list[Anomaly]:
    """Robust z-score on the *detrended* series.

    Testing the raw values hides exactly the failure we care about: as a chiller drifts
    upward the median rises and the MAD widens with it, so late spikes sit inside a band
    the drift itself inflated. Removing the linear trend first leaves the spikes standing
    proud of it, which is the whole signature of a machine on its way out.

    The trend is not lost — assess_risk scores it separately as its own driver.
    """
    values = _detrend([r.value for r in readings])
    median = statistics.median(values)
    deviations = [abs(v - median) for v in values]
    mad = statistics.median(deviations)

    scale = mad * MAD_TO_SIGMA if mad else statistics.pstdev(values)
    if _is_negligible(scale, readings):
        # Either a stuck sensor reading one number forever, or a perfectly clean signal
        # whose residuals are floating-point dust. Neither is a failing machine.
        return []

    anomalies: list[Anomaly] = []
    for reading, residual in zip(readings, values, strict=True):
        z = abs(residual - median) / scale
        if z >= ROBUST_Z_THRESHOLD:
            direction = "above" if residual > median else "below"
            anomalies.append(
                Anomaly(
                    recorded_at=reading.recorded_at,
                    value=reading.value,
                    score=round(min(1.0, z / (ROBUST_Z_THRESHOLD * 2)), 4),
                    reason=(
                        f"{reading.value:.2f} is {z:.1f} deviations {direction} "
                        f"this asset's underlying trend"
                    ),
                )
            )
    return anomalies


def _isolation_forest(readings: list[Reading]) -> list[Anomaly] | None:
    """Isolation Forest over (level, rate-of-change), gated by an absolute test.

    The gate matters. `contamination` is a prior on what fraction of points are
    outliers, so a fixed value flags that fraction *by construction* — a perfectly
    healthy chiller would report 5% of its readings as anomalies, and a team that gets
    three false alarms stops reading the fourth. `contamination="auto"` helps but still
    has no notion of "this machine is simply fine".

    So the forest ranks and scores, and a point is only reported if it is also genuinely
    far from normal on its level or its rate of change. The forest earns its place by
    catching combinations a level-only test misses — a reading inside the normal band
    that arrived via an abnormal jump — while the gate keeps a healthy asset silent.
    """
    try:
        import numpy as np
        from sklearn.ensemble import IsolationForest
    except ImportError:
        return None

    try:
        values = np.array([r.value for r in readings]).reshape(-1, 1)
        # Rate of change matters as much as level: a chiller drifting up fast is a
        # different problem from one sitting at a high but steady temperature.
        deltas = np.diff(values.flatten(), prepend=values[0][0]).reshape(-1, 1)
        features = np.hstack([values, deltas])

        model = IsolationForest(contamination="auto", random_state=42, n_estimators=150)
        predictions = model.fit_predict(features)
        scores = model.score_samples(features)
    except Exception:
        log.exception("Isolation Forest failed; falling back to robust z-score")
        return None

    level_outlier = _robust_outlier_mask([r.value for r in readings])
    # Deltas are already a difference, so there is no trend left to remove. The first
    # one is fabricated — np.diff prepends the opening value, making it exactly zero —
    # so it is judged against the rest and never flagged on its own account.
    delta_values = deltas.flatten().tolist()
    delta_outlier = [False] + _robust_outlier_mask(delta_values[1:], detrend=False)

    median = float(np.median(values))
    anomalies: list[Anomaly] = []
    for index, (reading, prediction, score) in enumerate(
        zip(readings, predictions, scores, strict=True)
    ):
        if prediction != -1:
            continue
        if not (level_outlier[index] or delta_outlier[index]):
            continue  # unusual to the forest, but not actually far from normal
        direction = "above" if reading.value > median else "below"
        anomalies.append(
            Anomaly(
                recorded_at=reading.recorded_at,
                value=reading.value,
                # score_samples is negative, more negative being more anomalous.
                score=round(min(1.0, float(-score)), 4),
                reason=f"{reading.value:.2f} sits well {direction} this asset's normal pattern",
            )
        )
    return anomalies


def _is_negligible(scale: float, readings: list[Reading]) -> bool:
    """Is this spread just noise, relative to what the sensor actually reads?"""
    magnitude = max((abs(r.value) for r in readings), default=0.0) or 1.0
    return scale <= magnitude * RELATIVE_NOISE_FLOOR


def _detrend(values: list[float]) -> list[float]:
    """Residuals after removing a least-squares straight line."""
    n = len(values)
    if n < MIN_POINTS:
        return list(values)
    mean_x = (n - 1) / 2
    mean_y = statistics.fmean(values)
    denominator = sum((i - mean_x) ** 2 for i in range(n))
    if denominator == 0:
        return list(values)
    slope = sum((i - mean_x) * (v - mean_y) for i, v in enumerate(values)) / denominator
    intercept = mean_y - slope * mean_x
    return [v - (slope * i + intercept) for i, v in enumerate(values)]


def _robust_outlier_mask(values: list[float], *, detrend: bool = True) -> list[bool]:
    """Which values are genuinely far from normal, on the MAD scale."""
    if not values:
        return []
    magnitude = max(abs(v) for v in values) or 1.0
    if detrend:
        values = _detrend(values)
    median = statistics.median(values)
    mad = statistics.median([abs(v - median) for v in values])
    scale = mad * MAD_TO_SIGMA if mad else statistics.pstdev(values)
    if scale <= magnitude * RELATIVE_NOISE_FLOOR:
        return [False] * len(values)
    return [abs(v - median) / scale >= ROBUST_Z_THRESHOLD for v in values]


def assess_risk(
    *,
    readings: Sequence[Reading],
    anomalies: Sequence[Anomaly],
    method: str,
    last_serviced_on: date | None,
    service_interval_days: int,
    installed_on: date | None,
    criticality: str,
    issue_reports_90d: int,
    today: date,
) -> RiskAssessment:
    """Combine the signals into one 0..1 risk score, with the reasons that built it.

    Weighted rather than learned: with one demo property there is no failure history to
    fit a survival model on, and a transparent weighting a maintenance head can argue
    with beats a black box that cannot be questioned.
    """
    drivers: list[dict] = []
    risk = 0.0

    # 1. Unusual readings, weighted by how recent they are.
    #
    # Deliberately not a rate over the window: dividing by sample count means a longer
    # history makes a failing machine look healthier, which is backwards. Three severe
    # spikes yesterday is the same evidence whether we hold a fortnight of data or a
    # year. Recency carries the weight instead, because a machine that misbehaved in
    # March and has been fine since is not the one to send an engineer to today.
    if anomalies and readings:
        ordered = sorted(readings, key=lambda r: r.recorded_at)
        window_start, window_end = ordered[0].recorded_at, ordered[-1].recorded_at
        span = (window_end - window_start).total_seconds() or 1.0

        weighted = 0.0
        recent = 0
        for item in anomalies:
            position = (item.recorded_at - window_start).total_seconds() / span
            # Linear from 0.25 at the start of the window to 1.0 at the end.
            recency = 0.25 + 0.75 * max(0.0, min(1.0, position))
            weighted += item.score * recency
            if position >= 0.8:
                recent += 1

        # Saturating: the first couple of genuine anomalies carry most of the signal.
        contribution = min(0.35, 0.18 * weighted)
        risk += contribution
        detail = f"{len(anomalies)} unusual reading(s)"
        if recent:
            detail += f", {recent} in the most recent fifth of the window"
        drivers.append(
            {"label": "Sensor anomalies", "detail": detail, "weight": round(contribution, 3)}
        )

    # 2. Direction of travel. A rising trend is worse than a noisy flat one.
    trend = _trend_per_day(readings)
    if abs(trend) > 1e-9:
        values = [r.value for r in readings]
        baseline = abs(statistics.median(values)) or 1.0
        relative = abs(trend) / baseline
        if relative > 0.005:
            contribution = min(0.2, relative * 12)
            risk += contribution
            direction = "rising" if trend > 0 else "falling"
            drivers.append(
                {
                    "label": f"Readings {direction}",
                    "detail": f"Drifting {trend:+.3f} per day against a normal of {statistics.median(values):.2f}",
                    "weight": round(contribution, 3),
                }
            )

    # 3. Overdue service.
    if last_serviced_on is not None:
        days_since = (today - last_serviced_on).days
        overdue_ratio = days_since / max(service_interval_days, 1)
        if overdue_ratio > 1.0:
            contribution = min(0.25, (overdue_ratio - 1.0) * 0.5)
            risk += contribution
            drivers.append(
                {
                    "label": "Service overdue",
                    "detail": f"Last serviced {days_since} days ago, interval is {service_interval_days}",
                    "weight": round(contribution, 3),
                }
            )
    else:
        risk += 0.08
        drivers.append(
            {"label": "Never serviced", "detail": "No service record on file", "weight": 0.08}
        )

    # 4. Repeat complaints. Staff reporting the same machine is real-world evidence
    # that the sensors may not be picking up.
    if issue_reports_90d:
        contribution = min(0.15, issue_reports_90d * 0.05)
        risk += contribution
        drivers.append(
            {
                "label": "Reported by staff",
                "detail": f"{issue_reports_90d} issue report(s) in the last 90 days",
                "weight": round(contribution, 3),
            }
        )

    # 5. Age.
    if installed_on is not None:
        years = (today - installed_on).days / 365.25
        if years > 7:
            contribution = min(0.12, (years - 7) * 0.02)
            risk += contribution
            drivers.append(
                {
                    "label": "Ageing asset",
                    "detail": f"{years:.0f} years old",
                    "weight": round(contribution, 3),
                }
            )

    # Criticality does not make failure more likely — it makes it matter more. It scales
    # the score so the queue puts a failing chiller above a failing lobby fountain.
    criticality_scale = {"low": 0.7, "medium": 1.0, "high": 1.2, "critical": 1.4}
    risk = min(1.0, risk * criticality_scale.get(criticality, 1.0))

    # Confidence is about the evidence, not the verdict: a high score from 30 readings
    # deserves less trust than the same score from 300.
    confidence = min(0.95, 0.3 + min(len(readings), 400) / 400 * 0.5 + (0.15 if method == "isolation_forest" else 0.0))

    return RiskAssessment(
        risk_score=round(risk, 4),
        confidence=round(confidence, 4),
        drivers=sorted(drivers, key=lambda d: d["weight"], reverse=True),
        method=method,
        anomaly_count=len(anomalies),
        trend_per_day=round(trend, 6),
    )


def _trend_per_day(readings: Sequence[Reading]) -> float:
    if len(readings) < MIN_POINTS:
        return 0.0
    ordered = sorted(readings, key=lambda r: r.recorded_at)
    start = ordered[0].recorded_at
    xs = [(r.recorded_at - start).total_seconds() / 86400 for r in ordered]
    ys = [r.value for r in ordered]
    mean_x, mean_y = statistics.fmean(xs), statistics.fmean(ys)
    denominator = sum((x - mean_x) ** 2 for x in xs)
    if denominator == 0:
        return 0.0
    return sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys, strict=True)) / denominator


def suggest_service_window(forecast_nights: list[dict], *, within_days: int = 14) -> dict | None:
    """Pick the quietest night to take the machine offline.

    This is the part that makes the card worth approving: anyone can say the chiller
    needs servicing, the useful bit is "do it Tuesday, we are 41% full".
    """
    candidates = [n for n in forecast_nights[:within_days] if n.get("predicted_occupancy") is not None]
    if not candidates:
        return None
    quietest = min(candidates, key=lambda n: n["predicted_occupancy"])
    return {
        "date": quietest["stay_date"],
        "predicted_occupancy": quietest["predicted_occupancy"],
        "reason": f"Quietest night in the next {within_days} days at "
        f"{quietest['predicted_occupancy']:.0%} occupancy",
    }
