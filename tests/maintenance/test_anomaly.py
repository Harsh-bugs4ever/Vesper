"""Anomaly detection and risk scoring.

The cases that matter operationally: a healthy machine must not be flagged (a maintenance
team that gets three false alarms stops reading the fourth), and a genuinely drifting one
must be, with reasons a human can argue with.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from app.api.maintenance.engines import anomaly
from app.api.maintenance.engines.anomaly import Anomaly, Reading

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


def test_spikes_on_a_rising_trend_are_still_caught():
    """The failing-chiller signature: a drift with spikes on top.

    Without detrending, the rising median and widening MAD swallow the spikes — the
    machine hides its own failure inside the trend it is causing.
    """
    readings = []
    for i in range(200):
        level = 2.4 + (i / 200) * 1.4  # a steady climb
        if i > 180 and i % 4 == 0:
            level += 1.8  # intermittent spikes late on
        readings.append(Reading(recorded_at=START + timedelta(hours=2 * i), value=level))

    anomalies, _method = anomaly.detect(readings)
    assert anomalies, "spikes riding a trend must still register"
    # Every one should come from the late, spiking part of the window.
    assert all(a.recorded_at > START + timedelta(hours=2 * 175) for a in anomalies)


def test_a_pure_trend_with_no_spikes_raises_no_anomalies():
    """A smooth drift is a trend, not an anomaly — assess_risk scores it separately."""
    smooth = [
        Reading(recorded_at=START + timedelta(hours=2 * i), value=2.4 + (i / 200) * 1.4)
        for i in range(200)
    ]
    anomalies, _ = anomaly.detect(smooth)
    assert anomalies == []


def test_recent_anomalies_outweigh_old_ones():
    """An engineer is sent to the machine misbehaving now, not the one that did in March."""
    readings = steady(n=200)

    def anomaly_at(when):
        return [Anomaly(recorded_at=when, value=40.0, score=1.0, reason="spike")]

    early = _assess(readings, anomaly_at(readings[2].recorded_at), "robust_z")
    late = _assess(readings, anomaly_at(readings[-1].recorded_at), "robust_z")
    assert late.risk_score > early.risk_score


def test_more_history_does_not_make_a_failing_machine_look_healthier():
    """The bug in a rate-over-window formulation: the denominator grows, the signal shrinks."""
    short_window = steady(n=60)
    long_window = steady(n=400)

    def spike_at_end(readings):
        return [Anomaly(recorded_at=readings[-1].recorded_at, value=40.0, score=1.0, reason="spike")]

    short = _assess(short_window, spike_at_end(short_window), "robust_z")
    long = _assess(long_window, spike_at_end(long_window), "robust_z")
    assert long.risk_score == short.risk_score
