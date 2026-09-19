"""Scoring a guest from staff reviews.

The output decides who gets a free upgrade and who gets a quiet word, so the properties
that matter are about fairness, not arithmetic: one voice must not decide, a complaint
must not become a penalty, and silence must not look like a verdict.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(SERVICE_ROOT.parents[1] / "packages" / "py-common"))

from app.engines import guest_rating  # noqa: E402
from app.engines.guest_rating import Review  # noqa: E402


def reviews(*ratings: int, department: str = "hk", conflicted: bool = False) -> list[Review]:
    return [
        Review(
            reviewer_id=f"user-{i}",
            department_id=department,
            rating=r,
            comment=None,
            conflicted=conflicted,
        )
        for i, r in enumerate(ratings)
    ]


# --- not enough to judge on -------------------------------------------------------


def test_no_reviews_is_not_a_score():
    result = guest_rating.summarise([])
    assert not result.is_scored
    assert result.score is None
    assert result.tier == "unrated"


def test_a_single_review_is_not_a_rating():
    """One person's opinion must not decide how a guest is treated."""
    result = guest_rating.summarise(reviews(5))
    assert not result.is_scored
    assert result.score is None
    assert result.tier == "insufficient"
    assert "1 review" in result.reasons[0]


def test_the_mean_is_still_shown_when_unscored():
    """A manager can read the raw reviews; they just do not get a ranking number."""
    result = guest_rating.summarise(reviews(4))
    assert result.mean_rating == 4.0
    assert result.score is None


def test_two_reviews_are_enough_to_score():
    result = guest_rating.summarise(reviews(4, 5))
    assert result.is_scored
    assert result.score is not None


# --- the Bayesian average ---------------------------------------------------------


def test_two_perfect_reviews_do_not_qualify_but_three_do():
    """The calibration point, pinned so a later tweak to the prior is a deliberate act.

    A stay has three or four staff touchpoints, so three reviews is most of the people
    who met the guest. The prior has to be light enough that unanimous praise from the
    floor can clear the bar, and heavy enough that two voices cannot.
    """
    two = guest_rating.summarise(reviews(5, 5))
    three = guest_rating.summarise(reviews(5, 5, 5))
    assert two.score < guest_rating.REWARD_THRESHOLD <= three.score


def test_a_thin_sample_is_pulled_toward_the_house_average():
    """Two fives should not read the same as twenty fives."""
    thin = guest_rating.summarise(reviews(5, 5))
    thick = guest_rating.summarise(reviews(*([5] * 20)))
    assert thin.score < thick.score
    assert thin.score < 5.0


def test_volume_earns_its_way_out_of_the_prior():
    scores = [guest_rating.summarise(reviews(*([5] * n))).score for n in (2, 5, 10, 25)]
    assert scores == sorted(scores), "more consistent praise should score higher"


def test_the_score_never_leaves_the_rating_scale():
    for ratings in ([1, 1], [5] * 50, [1] * 50, [3, 3, 3]):
        result = guest_rating.summarise(reviews(*ratings))
        assert 1.0 <= result.score <= 5.0


def test_a_poorly_regarded_guest_scores_below_a_well_regarded_one():
    assert (
        guest_rating.summarise(reviews(2, 2, 1)).score
        < guest_rating.summarise(reviews(5, 4, 5)).score
    )


def test_more_reviewers_means_more_confidence():
    assert (
        guest_rating.summarise(reviews(4, 4)).confidence
        < guest_rating.summarise(reviews(*([4] * 8))).confidence
    )


# --- fairness ---------------------------------------------------------------------


def test_a_conflicted_review_is_flagged_not_dropped():
    """The retaliation path: the department a guest complained about rates them down.

    Hiding the review would hide the conflict. It is counted and surfaced so a manager
    can weigh it themselves.
    """
    mixed = reviews(5, 4) + reviews(1, department="fnb", conflicted=True)
    result = guest_rating.summarise(mixed)

    assert result.conflicted_reviews == 1
    assert result.review_count == 3, "the review still counts toward the total"
    assert any("complained about" in r for r in result.reasons)


def test_department_disagreement_is_surfaced():
    """Housekeeping loving a guest the kitchen hated is the interesting case."""
    split = reviews(5, 5, department="hk") + reviews(1, 2, department="fnb")
    result = guest_rating.summarise(split)

    assert result.departments["hk"] > result.departments["fnb"]
    assert any("disagree" in r for r in result.reasons)


def test_departments_are_averaged_separately():
    split = reviews(4, 4, department="hk") + reviews(2, department="fnb")
    result = guest_rating.summarise(split)
    assert result.departments == {"hk": 4.0, "fnb": 2.0}


def test_every_score_explains_itself():
    """A number that decides how someone is treated has to show its reasoning."""
    result = guest_rating.summarise(reviews(5, 4, 5))
    assert result.reasons
    assert all(isinstance(r, str) and r for r in result.reasons)


# --- tiers and ranking ------------------------------------------------------------


@pytest.mark.parametrize(
    ("score", "expected"),
    [(4.8, "exceptional"), (4.2, "exceptional"), (3.8, "positive"), (3.0, "neutral"), (1.5, "needs_attention")],
)
def test_tiers_follow_the_score(score, expected):
    assert guest_rating.tier_for(score) == expected


def test_ranking_puts_the_best_regarded_first():
    entries = [
        ("low", guest_rating.summarise(reviews(2, 2))),
        ("high", guest_rating.summarise(reviews(5, 5, 5))),
        ("mid", guest_rating.summarise(reviews(4, 3))),
    ]
    assert [name for name, _ in guest_rating.rank(entries)][0] == "high"


def test_unscored_stays_sort_last_but_are_not_dropped():
    """"Three people still owe a review" is information, not noise."""
    entries = [
        ("unscored", guest_rating.summarise(reviews(5))),
        ("scored", guest_rating.summarise(reviews(3, 3))),
    ]
    ranked = [name for name, _ in guest_rating.rank(entries)]
    assert ranked == ["scored", "unscored"]
    assert len(ranked) == 2


# --- rewards ----------------------------------------------------------------------


def test_a_great_score_alone_does_not_earn_a_reward():
    """Otherwise a charming first-timer who spends nothing collects perks."""
    great = guest_rating.summarise(reviews(5, 5, 5, 5))
    worth_it, reasons = guest_rating.deserves_reward(great, objective_spend=200, visits=1)
    assert not worth_it
    assert any("objective signal" in r for r in reasons)


def test_a_great_score_with_real_spend_earns_one():
    great = guest_rating.summarise(reviews(5, 5, 5, 5))
    worth_it, reasons = guest_rating.deserves_reward(great, objective_spend=18000, visits=1)
    assert worth_it
    assert any("18,000" in r for r in reasons)


def test_a_returning_guest_counts_as_an_objective_signal():
    great = guest_rating.summarise(reviews(5, 5, 5, 4))
    worth_it, _ = guest_rating.deserves_reward(great, objective_spend=0, visits=4)
    assert worth_it


def test_a_mediocre_score_earns_nothing_however_much_they_spent():
    """Money does not buy its way past the staff's view."""
    mediocre = guest_rating.summarise(reviews(3, 3))
    worth_it, reasons = guest_rating.deserves_reward(mediocre, objective_spend=500000, visits=20)
    assert not worth_it
    assert any("threshold" in r for r in reasons)


def test_an_unscored_stay_earns_nothing():
    worth_it, reasons = guest_rating.deserves_reward(
        guest_rating.summarise(reviews(5)), objective_spend=50000, visits=10
    )
    assert not worth_it
    assert "Not enough reviews to act on" in reasons


def test_a_reward_names_its_conflicts():
    mixed = reviews(5, 5, 5) + reviews(5, department="fnb", conflicted=True)
    worth_it, reasons = guest_rating.deserves_reward(
        guest_rating.summarise(mixed), objective_spend=20000, visits=3
    )
    assert worth_it
    assert any("conflicted" in r for r in reasons)


# --- blending in the guest's own behaviour ----------------------------------------


def signals(**kw) -> guest_rating.GuestSignals:
    return guest_rating.GuestSignals(**kw)


def test_a_complaint_never_lowers_a_guests_standing():
    """The double-punishment trap.

    Staff rate a complainer down — that is human. If the complaint itself also counted
    against them, they would be punished twice for one act, and the second time it would
    look like data.
    """
    staff = guest_rating.summarise(reviews(4, 4, 4))
    clean = guest_rating.combine(staff, signals())
    complained = guest_rating.combine(staff, signals(complaints=3))

    assert complained.final_score >= clean.final_score


def test_bad_feedback_about_us_never_lowers_their_standing():
    """Rating us two stars makes them an at-risk guest, not a bad one."""
    staff = guest_rating.summarise(reviews(4, 4, 4))
    happy = guest_rating.combine(staff, signals(mean_sentiment=0.8))
    unhappy = guest_rating.combine(staff, signals(mean_sentiment=-0.8))

    assert unhappy.final_score >= happy.final_score - 1e-9


def test_engagement_lifts_the_score_a_little():
    staff = guest_rating.summarise(reviews(4, 4))
    quiet = guest_rating.combine(staff, signals(ratings_given=0))
    chatty = guest_rating.combine(staff, signals(ratings_given=3))

    assert chatty.final_score > quiet.final_score


def test_engagement_cannot_carry_a_poor_score():
    """Rating your breakfast is pleasant, not a qualification."""
    staff = guest_rating.summarise(reviews(2, 2))
    result = guest_rating.combine(staff, signals(ratings_given=50))

    assert result.engagement_bonus <= guest_rating.MAX_ENGAGEMENT_BONUS
    assert result.final_score < guest_rating.REWARD_THRESHOLD


def test_the_final_score_never_exceeds_the_scale():
    staff = guest_rating.summarise(reviews(*([5] * 30)))
    assert guest_rating.combine(staff, signals(ratings_given=40)).final_score <= 5.0


def test_a_complaint_plus_a_low_staff_score_is_flagged():
    """The pattern that might be payback. Surfaced, not silently corrected for."""
    staff = guest_rating.summarise(reviews(2, 2, 3))
    result = guest_rating.combine(staff, signals(complaints=1))

    assert result.possible_retaliation
    assert any("read the individual reviews" in r for r in result.reasons)


def test_a_complaint_with_a_good_staff_score_is_not_flagged():
    """No conflict to see: they complained and staff still thought well of them."""
    staff = guest_rating.summarise(reviews(5, 4, 5))
    result = guest_rating.combine(staff, signals(complaints=2))

    assert not result.possible_retaliation
    assert any("does not count against them" in r for r in result.reasons)


def test_a_low_score_with_no_complaint_is_not_flagged():
    staff = guest_rating.summarise(reviews(2, 2))
    assert not guest_rating.combine(staff, signals()).possible_retaliation


def test_their_sentiment_is_reported_alongside_not_folded_in():
    staff = guest_rating.summarise(reviews(4, 4))
    result = guest_rating.combine(staff, signals(mean_sentiment=-0.6))

    assert result.guest_sentiment == -0.6
    assert any("retention question" in r for r in result.reasons)


def test_an_unscored_stay_stays_unscored_after_blending():
    """Guest signals cannot manufacture a score out of one review."""
    result = guest_rating.combine(guest_rating.summarise(reviews(5)), signals(ratings_given=9))
    assert result.final_score is None
    assert result.staff_score is None
