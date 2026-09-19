"""Turning individual staff reviews of a guest into one defensible number.

The naive version — average the stars, sort descending — is wrong in three ways that
matter when the output decides who gets a free upgrade:

  * **One review is not a rating.** A guest with a single five from a delighted waiter
    would outrank one with nine fours from the whole floor. A Bayesian average fixes
    this: every guest starts pulled toward the house average and earns their way out of
    it with volume.
  * **A complaint is not misbehaviour.** The person a guest complained about can rate
    them, and the guest never sees it. Reviews from a department the guest raised a
    complaint against are flagged so a manager can see the conflict rather than have it
    silently drag a score down.
  * **Silence is not a verdict.** Below a minimum number of reviewers there is no score
    at all, rather than a confident-looking number built on one opinion.

Nothing here decides anything on its own. It produces a score and the reasons behind it;
a human approves any reward that follows.
"""
from __future__ import annotations

import statistics
from collections import Counter
from dataclasses import dataclass, field

# Ratings are 1-5, so an unopinionated prior sits in the middle.
HOUSE_AVERAGE = 3.5
# How many imaginary average reviews every guest starts with.
#
# Calibrated to the domain rather than copied from the usual product-review setting. A
# Bayesian prior of five assumes a thin sample of a large population — ten ratings out of
# a possible ten thousand. Here it is closer to a census: a stay involves three or four
# staff touchpoints, so three reviews is most of the people who ever met the guest, not a
# fraction of them. A heavy prior would mean unanimous praise from the whole floor still
# fell short of the reward threshold, and the feature would never fire.
#
# At 2.5 the arithmetic lands where the judgement should: two perfect reviews reach 4.17
# and do not qualify, three reach 4.32 and do. One voice still decides nothing, because
# MIN_REVIEWS_FOR_SCORE refuses to produce a score at all below two.
PRIOR_WEIGHT = 2.5
# Below this, show the reviews but no score. One person's opinion is not a rating.
MIN_REVIEWS_FOR_SCORE = 2
# A guest this well regarded is worth a thank-you.
REWARD_THRESHOLD = 4.2
# Reviews this low are worth a manager's eye, not a discount.
CONCERN_THRESHOLD = 2.5


@dataclass(slots=True)
class Review:
    """One staff member's view of one stay."""

    reviewer_id: str
    department_id: str | None
    rating: int
    comment: str | None = None
    # Set when this reviewer's department is one the guest complained about.
    conflicted: bool = False


@dataclass(slots=True)
class Score:
    review_count: int
    mean_rating: float | None
    # Bayesian average — what the ranking actually sorts on.
    score: float | None
    confidence: float
    tier: str
    departments: dict[str, float] = field(default_factory=dict)
    reasons: list[str] = field(default_factory=list)
    conflicted_reviews: int = 0
    # False until enough people have spoken.
    is_scored: bool = False


def summarise(reviews: list[Review]) -> Score:
    """Aggregate one stay's reviews into a single score with its reasoning."""
    if not reviews:
        return Score(
            review_count=0,
            mean_rating=None,
            score=None,
            confidence=0.0,
            tier="unrated",
            reasons=["Nobody has reviewed this stay"],
            is_scored=False,
        )

    ratings = [r.rating for r in reviews]
    mean = statistics.fmean(ratings)
    conflicted = sum(1 for r in reviews if r.conflicted)
    reasons: list[str] = []

    if len(reviews) < MIN_REVIEWS_FOR_SCORE:
        return Score(
            review_count=len(reviews),
            mean_rating=round(mean, 2),
            score=None,
            confidence=0.0,
            tier="insufficient",
            departments=_by_department(reviews),
            reasons=[
                f"Only {len(reviews)} review so far — {MIN_REVIEWS_FOR_SCORE} are needed "
                "before this counts as a rating"
            ],
            conflicted_reviews=conflicted,
            is_scored=False,
        )

    # Bayesian average: the prior holds a thin sample near the house average.
    bayesian = (PRIOR_WEIGHT * HOUSE_AVERAGE + sum(ratings)) / (PRIOR_WEIGHT + len(ratings))

    reasons.append(
        f"{len(reviews)} reviews averaging {mean:.1f}, weighted to {bayesian:.2f} "
        f"against a house average of {HOUSE_AVERAGE}"
    )

    departments = _by_department(reviews)
    if len(departments) > 1:
        spread = max(departments.values()) - min(departments.values())
        if spread >= 2.0:
            low = min(departments, key=lambda d: departments[d])
            reasons.append(
                f"Departments disagree by {spread:.1f} stars — the lowest is {low}, "
                "which is worth reading before acting"
            )

    if conflicted:
        reasons.append(
            f"{conflicted} review(s) came from a department this guest complained about; "
            "weigh them accordingly"
        )

    # More reviewers, and more departments, means a more trustworthy picture.
    confidence = min(0.95, 0.3 + min(len(reviews), 8) * 0.07 + min(len(departments), 4) * 0.05)

    return Score(
        review_count=len(reviews),
        mean_rating=round(mean, 2),
        score=round(bayesian, 4),
        confidence=round(confidence, 3),
        tier=tier_for(bayesian),
        departments=departments,
        reasons=reasons,
        conflicted_reviews=conflicted,
        is_scored=True,
    )


def tier_for(score: float) -> str:
    """A word a manager can act on, rather than a number to interpret."""
    if score >= REWARD_THRESHOLD:
        return "exceptional"
    if score >= 3.6:
        return "positive"
    if score >= CONCERN_THRESHOLD:
        return "neutral"
    return "needs_attention"


def _by_department(reviews: list[Review]) -> dict[str, float]:
    totals: Counter[str] = Counter()
    counts: Counter[str] = Counter()
    for review in reviews:
        key = review.department_id or "unassigned"
        totals[key] += review.rating
        counts[key] += 1
    return {key: round(totals[key] / counts[key], 2) for key in totals}


def rank(scored: list[tuple[str, Score]]) -> list[tuple[str, Score]]:
    """Order guests for the manager's list.

    Unscored stays sort last rather than being dropped: "three people still owe a review"
    is information a manager wants, and hiding it would make the list look complete when
    it is not.
    """
    return sorted(
        scored,
        key=lambda item: (
            item[1].is_scored,
            item[1].score or 0.0,
            item[1].confidence,
            item[1].review_count,
        ),
        reverse=True,
    )


def deserves_reward(score: Score, *, objective_spend: float, visits: int) -> tuple[bool, list[str]]:
    """Whether to put a thank-you in front of a manager.

    Staff opinion alone is not enough. A reward needs the guest to have been well
    regarded *and* to have actually been a good customer by a measure nobody can bias —
    spend or repeat visits. That way a popular guest who never spends anything does not
    collect perks on charm, and an unpopular regular is not quietly cut off.
    """
    reasons: list[str] = []
    if not score.is_scored:
        return False, ["Not enough reviews to act on"]
    if score.score is None or score.score < REWARD_THRESHOLD:
        return False, [f"Score {score.score:.2f} is below the {REWARD_THRESHOLD} threshold"]

    reasons.append(f"Staff rated this stay {score.score:.2f} across {score.review_count} reviews")

    objective = objective_spend >= 5000 or visits >= 2
    if not objective:
        return False, reasons + [
            "No objective signal yet — first visit and low spend, so a discount would be "
            "rewarding charm rather than custom"
        ]

    if objective_spend >= 5000:
        reasons.append(f"Spent Rs {objective_spend:,.0f} this stay")
    if visits >= 2:
        reasons.append(f"{visits} visits on record")
    if score.conflicted_reviews:
        reasons.append(
            f"{score.conflicted_reviews} review(s) may be conflicted — manager should confirm"
        )
    return True, reasons
