"""Scoring staff from guest ratings.

The failure modes here are not arithmetic ones. They are the ways a plausible-looking
number quietly says something untrue about a person's work: rewarding exposure, treating
one delighted guest as evidence, letting a bad March outrank a good September, or
producing a confident figure out of a complaint.
"""
from __future__ import annotations

import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(SERVICE_ROOT.parents[1] / "packages" / "py-common"))

from app.engines import staff_rating  # noqa: E402


def reviews(*specs: tuple[str, int, float]) -> list[staff_rating.StaffReview]:
    """(guest, rating, age in days) triples, for brevity in the tests below."""
    return [
        staff_rating.StaffReview(reviewer_id=who, rating=rating, age_days=age)
        for who, rating, age in specs
    ]


# --- Not enough evidence is not a low score ----------------------------------------


def test_nobody_has_rated_them_yet():
    score = staff_rating.summarise([])

    assert score.score is None
    assert score.tier == "unrated"
    assert not score.is_scored


def test_one_delighted_guest_is_not_a_rating():
    score = staff_rating.summarise(reviews(("g1", 5, 1)))

    assert score.score is None, "a single five must not produce a score"
    assert score.tier == "insufficient"
    assert score.mean_rating == 5.0, "the raw mean is still reported"
    assert not score.is_scored


def test_three_guests_is_still_not_enough():
    score = staff_rating.summarise(reviews(("g1", 5, 1), ("g2", 5, 2), ("g3", 5, 3)))

    assert score.score is None
    assert staff_rating.MIN_REVIEWS_FOR_SCORE == 4
    assert "4 different guests are needed" in " ".join(score.reasons)


def test_four_guests_produces_a_score():
    score = staff_rating.summarise(
        reviews(("g1", 5, 1), ("g2", 4, 2), ("g3", 5, 3), ("g4", 4, 4))
    )

    assert score.is_scored
    assert score.score is not None
    assert score.tier in {"strong", "exceptional"}


# --- Volume must not beat quality --------------------------------------------------


def test_thin_sample_is_pulled_toward_the_house_average():
    """Four perfect scores should not sit at 5.0 while thirty fours sit at 4.0."""
    thin = staff_rating.summarise(reviews(*[(f"g{i}", 5, 1) for i in range(4)]))
    thick = staff_rating.summarise(reviews(*[(f"g{i}", 5, 1) for i in range(40)]))

    assert thin.score is not None and thick.score is not None
    assert thin.score < thick.score, "more evidence should mean less shrinkage"
    assert thin.score < 5.0, "a thin sample must not reach the maximum"
    assert thin.thin_evidence
    assert not thick.thin_evidence


def test_many_good_ratings_outrank_a_few_perfect_ones():
    """The night auditor problem: the concierge should not win on volume alone."""
    few_perfect = staff_rating.summarise(reviews(*[(f"a{i}", 5, 1) for i in range(4)]))
    many_good = staff_rating.summarise(reviews(*[(f"b{i}", 5, 1) for i in range(25)]))

    ranked = staff_rating.rank([("few", few_perfect), ("many", many_good)])
    assert ranked[0][0] == "many"


def test_confidence_rises_with_evidence():
    small = staff_rating.summarise(reviews(*[(f"g{i}", 4, 1) for i in range(4)]))
    large = staff_rating.summarise(reviews(*[(f"g{i}", 4, 1) for i in range(40)]))

    assert large.confidence > small.confidence
    assert 0.0 <= small.confidence <= 1.0 and 0.0 <= large.confidence <= 1.0


# --- One guest, one voice ----------------------------------------------------------


def test_the_same_guest_rating_three_times_counts_once():
    score = staff_rating.summarise(
        reviews(("g1", 1, 1), ("g1", 1, 2), ("g1", 1, 3), ("g2", 5, 1), ("g3", 5, 1), ("g4", 5, 1))
    )

    assert score.review_count == 4, "four distinct guests, not six ratings"


def test_the_freshest_rating_from_a_repeat_guest_wins():
    score = staff_rating.summarise(
        reviews(("g1", 1, 300), ("g1", 5, 1), ("g2", 5, 1), ("g3", 5, 1), ("g4", 5, 1))
    )

    assert score.mean_rating == 5.0, "the 300-day-old 1 should have been superseded"


# --- Recency -----------------------------------------------------------------------


def test_recent_ratings_count_for_more_than_old_ones():
    improved = staff_rating.summarise(
        reviews(("g1", 2, 300), ("g2", 2, 280), ("g3", 5, 3), ("g4", 5, 1))
    )
    declined = staff_rating.summarise(
        reviews(("g1", 5, 300), ("g2", 5, 280), ("g3", 2, 3), ("g4", 2, 1))
    )

    assert improved.score is not None and declined.score is not None
    assert improved.score > declined.score, "someone who improved should outrank someone who slipped"


def test_a_year_old_rating_is_worth_nothing():
    assert staff_rating.recency_weight(staff_rating.MAX_AGE_DAYS) == 0.0
    assert staff_rating.recency_weight(0) == 1.0
    assert staff_rating.recency_weight(staff_rating.RECENCY_HALF_LIFE_DAYS) == 0.5


def test_entirely_stale_ratings_produce_no_score():
    score = staff_rating.summarise(reviews(*[(f"g{i}", 5, 400) for i in range(6)]))

    assert score.score is None
    assert score.tier == "stale"
    assert not score.is_scored


# --- Context, not silent discounting -----------------------------------------------


def test_a_rating_given_during_a_complaint_is_flagged_not_dropped():
    given = [
        staff_rating.StaffReview(reviewer_id="g1", rating=2, age_days=1, during_complaint=True),
        staff_rating.StaffReview(reviewer_id="g2", rating=5, age_days=1),
        staff_rating.StaffReview(reviewer_id="g3", rating=5, age_days=1),
        staff_rating.StaffReview(reviewer_id="g4", rating=5, age_days=1),
    ]
    score = staff_rating.summarise(given)

    assert score.review_count == 4, "the flagged review still counts"
    assert score.complaint_context_reviews == 1
    assert any("open complaint" in reason for reason in score.reasons)


def test_severity_corrected_ratings_are_used_when_supplied():
    given = reviews(("harsh", 3, 1), ("g2", 3, 1), ("g3", 3, 1), ("g4", 3, 1))

    raw = staff_rating.summarise(given)
    corrected = staff_rating.summarise(given, adjusted={"harsh": 4.2})

    assert corrected.score is not None and raw.score is not None
    assert corrected.score > raw.score
    assert any("how harshly" in reason for reason in corrected.reasons)


# --- What the score is allowed to conclude -----------------------------------------


def test_recognition_needs_a_real_score_on_real_evidence():
    thin = staff_rating.summarise(reviews(*[(f"g{i}", 5, 1) for i in range(4)]))
    solid = staff_rating.summarise(reviews(*[(f"g{i}", 5, 1) for i in range(20)]))

    assert not thin.deserves_recognition, "four guests is not enough to single someone out"
    assert solid.deserves_recognition


def test_a_low_score_asks_for_a_conversation_not_a_consequence():
    score = staff_rating.summarise(reviews(*[(f"g{i}", 2, 1) for i in range(12)]))

    assert score.merits_a_conversation
    # The engine exposes no disciplinary signal at all; this is the whole surface.
    assert not hasattr(score, "flag_for_hr")
    assert not hasattr(score, "bottom_performer")


def test_unscored_people_are_left_off_the_board_rather_than_placed_last():
    good = staff_rating.summarise(reviews(*[(f"g{i}", 5, 1) for i in range(10)]))
    unrated = staff_rating.summarise(reviews(("g1", 5, 1)))

    ranked = staff_rating.rank([("good", good), ("new", unrated)])
    left_off = staff_rating.unranked([("good", good), ("new", unrated)])

    assert [sid for sid, _ in ranked] == ["good"]
    assert [sid for sid, _ in left_off] == ["new"]


def test_ties_break_toward_the_better_evidenced_score():
    shaky = staff_rating.summarise(reviews(*[(f"a{i}", 4, 1) for i in range(5)]))
    solid = staff_rating.summarise(reviews(*[(f"b{i}", 4, 1) for i in range(30)]))

    ranked = staff_rating.rank([("shaky", shaky), ("solid", solid)])
    assert ranked[0][0] == "solid"
