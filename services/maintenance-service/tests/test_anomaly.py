"""Anomaly detection and risk scoring.

The cases that matter operationally: a healthy machine must not be flagged (a maintenance
team that gets three false alarms stops reading the fourth), and a genuinely drifting one
must be, with reasons a human can argue with.
"""
from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(SERVICE_ROOT.parents[1] / "packages" / "py-common"))

from app.engines import anomaly  # noqa: E402
from app.engines.anomaly import Reading  # noqa: E402

START = datetime(2026, 9, 1, tzinfo=timezone.utc)
TODAY = date(2026, 9, 17)


def steady(n: int = 200, value: float = 2.4, wobble: float = 0.05) -> list[Reading]:
    """A healthy machine: small deterministic wobble around a constant."""
    return [
        Reading(recorded_at=START + timedelta(hours=2 * i), value=value + wobble * ((i % 5) - 2) / 2)
        for i in range(n)
    ]


def drifting(n: int = 200, value: float = 2.4) -> list[Reading]:
    """A chiller on its way out: a rising trend plus late spikes."""
    readings = []
    for i in range(n):
        progress = i / n
        level = value + progress * value * 0.6
        if progress > 0.9 and i % 4 == 0:
            level += value * 0.7
        readings.append(
            Reading(recorded_at=START + timedelta(hours=2 * i), value=level + 0.05 * ((i % 5) - 2))
        )
    return readings


def test_healthy_machine_raises_no_anomalies():
    anomalies, method = anomaly.detect(steady())
    assert anomalies == []
    assert method in {"isolation_forest", "robust_z"}


def test_too_little_data_says_so_rather_than_guessing():
    anomalies, method = anomaly.detect(steady(n=5))
    assert anomalies == []
    assert method == "insufficient_data"


def test_a_clear_outlier_is_caught():
    readings = steady()
    readings[100] = Reading(recorded_at=readings[100].recorded_at, value=40.0)
    anomalies, _ = anomaly.detect(readings)
    assert any(a.value == 40.0 for a in anomalies)


def test_every_anomaly_explains_itself():
    readings = steady()
    readings[50] = Reading(recorded_at=readings[50].recorded_at, value=30.0)
    anomalies, _ = anomaly.detect(readings)
    assert anomalies
    for item in anomalies:
        assert item.reason, "an anomaly with no reason cannot be shown on a chart"
        assert 0.0 <= item.score <= 1.0


def test_a_stuck_sensor_is_not_an_anomaly():
    """A flatlining sensor reads oddly but is not evidence the machine is failing."""
    flat = [Reading(recorded_at=START + timedelta(hours=i), value=5.0) for i in range(100)]
    anomalies, _ = anomaly.detect(flat)
    assert anomalies == []


def _assess(readings, anomalies, method, **overrides):
    defaults = dict(
        last_serviced_on=TODAY - timedelta(days=30),
        service_interval_days=180,
        installed_on=date(2022, 1, 1),
        criticality="medium",
        issue_reports_90d=0,
        today=TODAY,
    )
    defaults.update(overrides)
    return anomaly.assess_risk(readings=readings, anomalies=anomalies, method=method, **defaults)


def test_healthy_recently_serviced_asset_scores_low():
    readings = steady()
    anomalies, method = anomaly.detect(readings)
    assessment = _assess(readings, anomalies, method)
    assert assessment.risk_score < 0.3


def test_drifting_asset_scores_higher_than_a_healthy_one():
    healthy = steady()
    h_anom, h_method = anomaly.detect(healthy)
    bad = drifting()
    b_anom, b_method = anomaly.detect(bad)

    assert _assess(bad, b_anom, b_method).risk_score > _assess(healthy, h_anom, h_method).risk_score


def test_overdue_service_raises_risk_and_is_named():
    readings = steady()
    anomalies, method = anomaly.detect(readings)
    overdue = _assess(readings, anomalies, method, last_serviced_on=TODAY - timedelta(days=400))
    recent = _assess(readings, anomalies, method)

    assert overdue.risk_score > recent.risk_score
    assert any("overdue" in d["label"].lower() for d in overdue.drivers)


def test_staff_reports_raise_risk():
    """Sensors can miss what three housekeepers noticed."""
    readings = steady()
    anomalies, method = anomaly.detect(readings)
    assert (
        _assess(readings, anomalies, method, issue_reports_90d=4).risk_score
        > _assess(readings, anomalies, method).risk_score
    )


def test_criticality_scales_the_score_not_the_evidence():
    readings = drifting()
    anomalies, method = anomaly.detect(readings)
    low = _assess(readings, anomalies, method, criticality="low")
    critical = _assess(readings, anomalies, method, criticality="critical")

    assert critical.risk_score > low.risk_score
    # The same evidence produced both, so the reasons must match.
    assert [d["label"] for d in low.drivers] == [d["label"] for d in critical.drivers]


def test_risk_score_never_leaves_zero_to_one():
    readings = drifting()
    anomalies, method = anomaly.detect(readings)
    assessment = _assess(
        readings,
        anomalies,
        method,
        last_serviced_on=date(2015, 1, 1),
        installed_on=date(2001, 1, 1),
        criticality="critical",
        issue_reports_90d=50,
    )
    assert 0.0 <= assessment.risk_score <= 1.0


def test_more_evidence_means_more_confidence():
    small, large = steady(n=30), steady(n=400)
    s_anom, s_method = anomaly.detect(small)
    l_anom, l_method = anomaly.detect(large)
    assert _assess(large, l_anom, l_method).confidence > _assess(small, s_anom, s_method).confidence


def test_service_window_picks_the_quietest_night():
    nights = [
        {"stay_date": "2026-09-18", "predicted_occupancy": 0.91},
        {"stay_date": "2026-09-19", "predicted_occupancy": 0.88},
        {"stay_date": "2026-09-20", "predicted_occupancy": 0.41},
        {"stay_date": "2026-09-21", "predicted_occupancy": 0.77},
    ]
    window = anomaly.suggest_service_window(nights)
    assert window["date"] == "2026-09-20"
    assert "41%" in window["reason"]


def test_no_forecast_means_no_window_rather_than_a_bad_one():
    assert anomaly.suggest_service_window([]) is None
