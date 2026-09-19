"""Correcting for how hard a reviewer marks.

This cuts both ways and both matter. A guest whose stay happened to be covered by the
floor's harshest reviewer loses a thank-you they earned; a generous reviewer hands out
perks nobody else would. Neither fact is about the guest.
"""
from __future__ import annotations

import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(SERVICE_ROOT.parents[1] / "packages" / "py-common"))

from app.engines import fairness  # noqa: E402


def profiles(**people: list[int]) -> dict[str, fairness.ReviewerProfile]:
    return fairness.reviewer_profiles(list(people.items()))


def test_a_reviewer_in_line_with_everyone_is_left_alone():
    people = profiles(alex=[3, 4, 4, 3, 4, 4])
    result = fairness.correct([("alex", 4)], people, house=3.6)

    assert not result.applied
    assert result.adjustments[0].adjusted_rating == 4.0


def test_a_harsh_reviewers_rating_is_lifted():
    """Otherwise the guest pays for which shift happened to be on."""
    people = profiles(harsh=[2, 2, 1, 2, 2, 2])
    result = fairness.correct([("harsh", 2)], people, house=3.8)

    assert result.applied
    assert result.adjustments[0].adjusted_rating > 2.0
    assert "harder" in result.adjustments[0].note


def test_a_generous_reviewers_rating_is_pulled_down():
    people = profiles(sunny=[5, 5, 5, 5, 5, 4])
    result = fairness.correct([("sunny", 5)], people, house=3.4)

    assert result.adjustments[0].adjusted_rating < 5.0
    assert "generously" in result.adjustments[0].note


def test_a_thin_history_is_not_judged():
    """Three low scores is far more likely to be three difficult guests."""
    people = profiles(newcomer=[1, 2])
    result = fairness.correct([("newcomer", 1)], people, house=4.0)

    assert not result.applied
    assert "Not enough reviews" in result.adjustments[0].note


def test_an_unknown_reviewer_is_not_judged():
    result = fairness.correct([("stranger", 2)], {}, house=4.0)
    assert not result.applied
    assert result.adjustments[0].adjusted_rating == 2.0


def test_the_adjustment_is_capped():
    """The reviewer met the guest and we did not. This is a thumb on the scale."""
    people = profiles(extreme=[1, 1, 1, 1, 1, 1, 1, 1])
    result = fairness.correct([("extreme", 1)], people, house=5.0)

    shift = abs(result.adjustments[0].shift)
    assert shift <= fairness.MAX_ADJUSTMENT


def test_an_adjusted_rating_stays_on_the_scale():
    for history, house, given in (([1] * 8, 5.0, 1), ([5] * 8, 1.0, 5)):
        people = fairness.reviewer_profiles([("r", history)])
        result = fairness.correct([("r", given)], people, house=house)
        assert 1.0 <= result.adjustments[0].adjusted_rating <= 5.0


def test_the_original_rating_is_always_preserved():
    """The stored review is what the person actually gave. Nothing rewrites it."""
    people = profiles(harsh=[2, 2, 2, 1, 2, 2])
    result = fairness.correct([("harsh", 2)], people, house=4.0)

    assert result.adjustments[0].raw_rating == 2.0
    assert result.adjustments[0].adjusted_rating != 2.0


def test_outlier_reviewers_are_named_for_the_manager():
    """A reviewer far from everyone else is worth a quiet word, not a silent fix."""
    people = profiles(harsh=[1, 2, 1, 2, 1, 2], fair=[3, 4, 3, 4, 3, 4])
    result = fairness.correct([("harsh", 1), ("fair", 4)], people, house=3.5)

    assert "harsh" in result.outlier_reviewers
    assert "fair" not in result.outlier_reviewers


def test_the_correction_explains_itself():
    people = profiles(harsh=[2, 2, 2, 2, 1, 2])
    result = fairness.correct([("harsh", 2)], people, house=4.0)
    assert any("original ratings are unchanged" in r for r in result.reasons)


def test_the_house_average_is_weighted_by_volume():
    """Somebody who has written sixty reviews shapes the house scale more than a newcomer."""
    many = fairness.ReviewerProfile("many", reviews_given=60, mean_rating=3.0)
    few = fairness.ReviewerProfile("few", reviews_given=2, mean_rating=5.0)
    assert fairness.house_average([many, few]) < 3.2


def test_no_reviewers_falls_back_rather_than_dividing_by_zero():
    assert fairness.house_average([]) == 3.5


def test_no_ratings_is_handled():
    assert fairness.correct([], profiles(a=[3, 3, 3, 3, 3, 3])).adjustments == []


def test_two_reviewers_with_opposite_bias_meet_in_the_middle():
    """The point of the whole exercise: the same guest, read on a shared scale."""
    people = profiles(harsh=[2, 2, 2, 2, 2, 2], sunny=[5, 5, 5, 5, 5, 5])
    result = fairness.correct([("harsh", 2), ("sunny", 5)], people, house=3.5)

    adjusted = fairness.adjusted_ratings(result)
    assert adjusted[0] > 2.0, "the harsh one lifted"
    assert adjusted[1] < 5.0, "the generous one lowered"
    assert abs(adjusted[0] - adjusted[1]) < abs(2 - 5), "they moved closer together"
