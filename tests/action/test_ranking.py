"""Action card ranking.

The queue is the product. If ranking is wrong, the owner reads the wrong card first, and
everything the engines computed underneath is wasted.
"""
from __future__ import annotations

from decimal import Decimal

from app.api.action.models import Urgency
from app.api.action.service import IMPACT_SCALE, rank_score


def score(confidence=0.8, impact=20000, urgency=Urgency.MEDIUM) -> float:
    return rank_score(confidence, Decimal(str(impact)), urgency)


def test_score_is_always_a_fraction():
    for confidence in (0.0, 0.25, 0.5, 1.0):
        for impact in (0, 500, 50_000, 10_000_000):
            for urgency in Urgency:
                assert 0.0 <= rank_score(confidence, Decimal(impact), urgency) <= 1.0


def test_confidence_raises_the_score():
    assert score(confidence=0.9) > score(confidence=0.4)


def test_impact_raises_the_score():
    assert score(impact=90_000) > score(impact=3_000)


def test_urgency_raises_the_score():
    assert score(urgency=Urgency.CRITICAL) > score(urgency=Urgency.HIGH) > score(
        urgency=Urgency.MEDIUM
    ) > score(urgency=Urgency.LOW)


def test_a_worthless_card_scores_zero():
    assert rank_score(0.0, Decimal("250000"), Urgency.CRITICAL) == 0.0


def test_impact_saturates_so_one_huge_number_cannot_bury_everything():
    """A ₹50 lakh card must not push six urgent small ones off the top of the queue."""
    big = score(impact=float(IMPACT_SCALE) * 2)
    enormous = score(impact=float(IMPACT_SCALE) * 200)
    assert enormous == big


def test_a_small_certain_urgent_card_beats_a_large_doubtful_one():
    """The chiller about to fail outranks a speculative six-figure rate move."""
    urgent_small = rank_score(0.95, Decimal("30000"), Urgency.CRITICAL)
    vague_large = rank_score(0.35, Decimal("400000"), Urgency.LOW)
    assert urgent_small > vague_large


def test_a_zero_impact_card_still_ranks():
    """Some cards matter without a rupee figure; they must not vanish."""
    assert score(impact=0) > 0


def test_negative_impact_is_treated_by_magnitude():
    """A rate cut that protects revenue is as important as a rise that earns it."""
    assert score(impact=-40_000) == score(impact=40_000)


def test_ranking_orders_a_realistic_queue_sensibly():
    cards = {
        "chiller about to fail": rank_score(0.88, Decimal("180000"), Urgency.CRITICAL),
        "weekend rate rise": rank_score(0.72, Decimal("95000"), Urgency.HIGH),
        "bread reorder": rank_score(0.92, Decimal("3300"), Urgency.MEDIUM),
        "speculative promo": rank_score(0.31, Decimal("60000"), Urgency.LOW),
    }
    order = [name for name, _ in sorted(cards.items(), key=lambda i: i[1], reverse=True)]
    assert order[0] == "chiller about to fail"
    assert order[-1] == "speculative promo"
