"""Guest DNA and churn risk.

The risk half is the one that costs money if it is wrong: a false positive discounts a
guest who was always coming back, and a false negative loses a regular quietly.
"""
from __future__ import annotations

from datetime import date, timedelta

from app.api.guest_intel.engines import dna

TODAY = date(2026, 9, 17)


def every_n_days(gap: int, count: int, *, last_offset: int = 0) -> list[date]:
    """Visits on a steady rhythm, the most recent `last_offset` days ago."""
    return [TODAY - timedelta(days=last_offset + gap * i) for i in reversed(range(count))]


def assess(visits, **overrides):
    defaults = dict(
        visit_dates=visits,
        today=TODAY,
        average_spend=6000.0,
        recent_sentiment=0.2,
        segment="regular",
    )
    defaults.update(overrides)
    return dna.assess_risk(**defaults)


# --- churn risk --------------------------------------------------------------------


def test_a_guest_who_is_on_schedule_is_not_at_risk():
    """Visits every 30 days, last one 20 days ago. Nothing is wrong."""
    assert not assess(every_n_days(30, 6, last_offset=20)).is_at_risk


def test_a_regular_who_has_stopped_is_at_risk():
    """Visited monthly for half a year, then nothing for four months."""
    risk = assess(every_n_days(30, 6, last_offset=120))
    assert risk.is_at_risk
    assert risk.risk_score > 0.4
    assert risk.reasons


def test_risk_is_judged_against_the_guest_own_rhythm():
    """A quarterly visitor two months out is fine; a weekly one is not.

    Comparing everyone to a single global threshold is exactly the mistake this avoids.
    """
    quarterly = assess(every_n_days(90, 5, last_offset=60))
    weekly = assess(every_n_days(7, 12, last_offset=60))

    assert not quarterly.is_at_risk
    assert weekly.is_at_risk


def test_a_one_time_guest_is_not_at_risk():
    """They were never a regular, so they cannot be drifting away."""
    risk = assess([TODAY - timedelta(days=400)])
    assert not risk.is_at_risk
    assert risk.typical_gap_days is None
    assert "not enough" in risk.reasons[0].lower()


def test_no_history_at_all_is_not_at_risk():
    risk = assess([])
    assert not risk.is_at_risk
    assert risk.risk_score == 0.0
    assert risk.suggested_offer is None


def test_visits_spacing_out_is_caught_before_they_stop():
    """The earlier warning: still coming, but less and less often."""
    thinning = [
        TODAY - timedelta(days=d) for d in sorted([300, 285, 270, 255, 220, 170, 100], reverse=True)
    ]
    risk = assess(thinning)
    assert any("spacing out" in reason for reason in risk.reasons)


def test_unhappy_recent_feedback_raises_risk():
    visits = every_n_days(30, 6, last_offset=70)
    assert assess(visits, recent_sentiment=-0.6).risk_score > assess(visits, recent_sentiment=0.5).risk_score


def test_a_high_spender_drifting_is_ranked_above_a_low_spender():
    visits = every_n_days(30, 6, last_offset=90)
    assert assess(visits, average_spend=15000).risk_score > assess(visits, average_spend=2000).risk_score


def test_risk_score_stays_in_range():
    risk = assess(
        every_n_days(7, 20, last_offset=400), recent_sentiment=-1.0, average_spend=100000
    )
    assert 0.0 <= risk.risk_score <= 1.0


def test_an_at_risk_guest_gets_a_costed_offer():
    risk = assess(every_n_days(30, 8, last_offset=150), average_spend=9000, segment="loyal")
    assert risk.is_at_risk
    offer = risk.suggested_offer
    assert offer is not None
    assert 0 < offer["discount_pct"] <= 25
    assert offer["estimated_value"] > 0
    assert offer["rationale"]


def test_the_discount_is_capped():
    """Past 25% it stops being retention and starts training regulars to wait."""
    risk = assess(
        every_n_days(7, 30, last_offset=365), average_spend=100000, segment="loyal",
        recent_sentiment=-1.0,
    )
    assert risk.suggested_offer["discount_pct"] <= 25


def test_a_healthy_guest_is_offered_nothing():
    assert assess(every_n_days(30, 6, last_offset=10)).suggested_offer is None


# --- preference profile ------------------------------------------------------------


def order(name: str, quantity: int = 1, hour: int = 9) -> dict:
    return {"items": [{"name": name, "quantity": quantity}], "hour": hour}


def test_a_repeated_order_becomes_a_preference_chip():
    profile = dna.build_profile(
        orders=[order("Masala Chai") for _ in range(4)], ratings=[], visits=[], total_stays=5
    )
    labels = [p.label for p in profile.preferences]
    assert "Masala Chai" in labels
    assert "Masala Chai" in profile.favourite_items


def test_a_single_order_is_a_data_point_not_a_preference():
    profile = dna.build_profile(
        orders=[order("Tiramisu")], ratings=[], visits=[], total_stays=2
    )
    assert "Tiramisu" not in [p.label for p in profile.preferences]


def test_repetition_raises_the_chip_confidence():
    few = dna.build_profile(orders=[order("Poha")] * 2, ratings=[], visits=[], total_stays=3)
    many = dna.build_profile(orders=[order("Poha")] * 6, ratings=[], visits=[], total_stays=3)
    assert _confidence(many, "Poha") > _confidence(few, "Poha")


def _confidence(profile, label: str) -> float:
    return next(p.confidence for p in profile.preferences if p.label == label)


def test_every_chip_carries_its_own_confidence():
    profile = dna.build_profile(
        orders=[order("Club Sandwich", hour=21)] * 3, ratings=[], visits=[], total_stays=4
    )
    assert profile.preferences
    for preference in profile.preferences:
        assert 0.0 <= preference.confidence <= 1.0
        assert preference.label and preference.detail


def test_segments_follow_stay_count():
    def segment(stays: int) -> str:
        return dna.build_profile(orders=[], ratings=[], visits=[], total_stays=stays).segment

    assert segment(0) == "new"
    assert segment(1) == "new"
    assert segment(3) == "occasional"
    assert segment(6) == "regular"
    assert segment(12) == "loyal"


def test_average_sentiment_comes_from_scored_ratings():
    profile = dna.build_profile(
        orders=[],
        ratings=[{"sentiment_score": 0.8, "comment": "lovely"}, {"sentiment_score": 0.4, "comment": "good"}],
        visits=[],
        total_stays=4,
    )
    assert 0.55 < profile.average_sentiment < 0.65
    assert profile.sentiment_label in {"positive", "delighted"}


def test_complaint_themes_are_named_from_negative_comments():
    profile = dna.build_profile(
        orders=[],
        ratings=[{"sentiment_score": -0.7, "comment": "the room was dirty and smelly"}],
        visits=[],
        total_stays=4,
    )
    assert "cleanliness" in profile.complaint_themes


def test_themes_are_only_drawn_from_complaints():
    profile = dna.build_profile(
        orders=[],
        ratings=[{"sentiment_score": 0.9, "comment": "spotlessly clean room"}],
        visits=[],
        total_stays=4,
    )
    assert profile.complaint_themes == []


def test_an_empty_history_produces_an_empty_profile():
    profile = dna.build_profile(orders=[], ratings=[], visits=[], total_stays=0)
    assert profile.preferences == []
    assert profile.segment == "new"
    assert profile.observations == 0


def test_theme_detection_ranks_by_mentions():
    themes = dna.detect_themes("dirty room, dusty floor, stained sheets and a slow wait")
    assert themes[0] == "cleanliness"
