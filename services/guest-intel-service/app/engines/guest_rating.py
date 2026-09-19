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
# A guest this well regarded is worth the larger thank-you.
REWARD_THRESHOLD = 4.2
# Nothing below this at all. Above the midpoint on purpose: a thank-you is earned by
# being memorable, not by being unobjectionable.
COUPON_MIN_SCORE = 3.6
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
    # Gated at the coupon floor, not the top tier. These two used to disagree — this
    # refused anything under 4.2 while coupon_for offered 10% from 3.6, which made that
    # whole band unreachable. Eligibility is one question ("did they earn anything?") and
    # size is another; coupon_for owns the second.
    if score.score is None or score.score < COUPON_MIN_SCORE:
        return False, [
            f"Score {score.score:.2f} is below the {COUPON_MIN_SCORE} a thank-you starts at"
        ]

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


# --- blending in what the guest told us -------------------------------------------
#
# "Take everything into consideration" is right, but the direction matters enormously.
#
# A guest who complains has given us information. If staff then rate them down — which
# is the natural human reaction — and we *also* count the complaint itself against them,
# they are punished twice for the same act, and the second punishment is dressed up as
# data. So guest feedback can raise a guest's standing and can never lower it.
#
# Their sentiment toward us is a different question: it says how the relationship is
# going, not how good a guest they were. That belongs on the screen next to the score,
# not inside it. A guest who rated us two stars is not a bad guest; they are an at-risk
# guest, which the churn engine already handles.


# How much engagement can lift a score. Small on purpose: rating your breakfast is
# pleasant, not a qualification.
MAX_ENGAGEMENT_BONUS = 0.25
# Below this staff score, with a complaint on file, the pattern is worth a manager's eye.
RETALIATION_STAFF_SCORE = 3.2


@dataclass(slots=True)
class GuestSignals:
    """What the guest themselves did during the stay."""

    ratings_given: int = 0
    # Their mean sentiment toward us, -1..1. Reported, never subtracted.
    mean_sentiment: float = 0.0
    complaints: int = 0
    spend: float = 0.0
    visits: int = 0


@dataclass(slots=True)
class Combined:
    staff_score: float | None
    final_score: float | None
    tier: str
    engagement_bonus: float
    # True when a low staff score coincides with a complaint — read the reviews.
    possible_retaliation: bool
    guest_sentiment: float
    reasons: list[str] = field(default_factory=list)


def combine(staff: Score, signals: GuestSignals) -> Combined:
    """Fold the guest's own behaviour into their standing, upward only."""
    reasons = list(staff.reasons)

    if not staff.is_scored or staff.score is None:
        return Combined(
            staff_score=None,
            final_score=None,
            tier=staff.tier,
            engagement_bonus=0.0,
            possible_retaliation=False,
            guest_sentiment=signals.mean_sentiment,
            reasons=reasons,
        )

    # Engaging with the hotel — rating things, telling us how it went — is a small plus.
    bonus = min(MAX_ENGAGEMENT_BONUS, signals.ratings_given * 0.08)
    if bonus:
        reasons.append(
            f"Left {signals.ratings_given} rating(s) during the stay (+{bonus:.2f})"
        )

    final = min(5.0, staff.score + bonus)

    # The pattern that matters: this guest complained, and staff scored them low. It may
    # be fair and it may be payback. Either way a human should read the reviews rather
    # than let the number decide.
    retaliation = signals.complaints > 0 and staff.score < RETALIATION_STAFF_SCORE
    if retaliation:
        reasons.append(
            f"This guest raised {signals.complaints} complaint(s) and staff scored them "
            f"{staff.score:.2f} — read the individual reviews before acting on this"
        )
    elif signals.complaints:
        reasons.append(
            f"Raised {signals.complaints} complaint(s), which does not count against them"
        )

    if signals.mean_sentiment < -0.15:
        reasons.append(
            f"Their own feedback was {signals.mean_sentiment:+.2f} — a retention question, "
            "not a mark against them"
        )

    return Combined(
        staff_score=staff.score,
        final_score=round(final, 4),
        tier=tier_for(final),
        engagement_bonus=round(bonus, 4),
        possible_retaliation=retaliation,
        guest_sentiment=signals.mean_sentiment,
        reasons=reasons,
    )


# --- what the thank-you is actually worth -----------------------------------------
#
# A fixed "3 stars gets 20%" is the obvious design and it fails twice.
#
# **Three is the midpoint, not an achievement.** On a 1-5 scale most stays land at 3 or
# 4, so a threshold of 3 rewards roughly everyone. A discount everyone gets is not a
# thank-you, it is a price cut with extra paperwork — and it stops meaning anything to
# the guest precisely because it is unremarkable.
#
# **Twenty percent is aimed at the wrong guest.** The most expensive coupon should go to
# the guest least likely to come back, not to the one who already would have. Spending
# the biggest discount on a loyal regular buys a visit that was already happening.
#
# So the two questions are separated: how well regarded they were decides *whether* there
# is a coupon, and how likely they are to drift away decides *how much*. The engine that
# already scores churn risk is doing the second half.

# Base percentages by how well regarded the stay was.
COUPON_BASE = ((REWARD_THRESHOLD, 15.0), (COUPON_MIN_SCORE, 10.0))
# Added when the guest looks like drifting away — the case where a discount actually
# changes a decision rather than subsidising one already made.
AT_RISK_UPLIFT = 5.0
# Hard ceiling. Past this it stops being a thank-you and starts training regulars to
# wait for a discount before booking.
COUPON_MAX_PCT = 20.0


@dataclass(slots=True)
class Coupon:
    percent: float
    reasons: list[str] = field(default_factory=list)

    @property
    def offered(self) -> bool:
        return self.percent > 0


def coupon_for(score: float | None, *, churn_risk: float = 0.0, average_spend: float = 0.0) -> Coupon:
    """How large a thank-you this stay has earned, and why.

    `churn_risk` comes from the retention engine: 0 is a guest with a steady rhythm, 1 is
    one who has all but stopped coming.
    """
    if score is None:
        return Coupon(percent=0.0, reasons=["Not enough reviews to offer anything"])
    if score < COUPON_MIN_SCORE:
        return Coupon(
            percent=0.0,
            reasons=[
                f"Scored {score:.2f}, below the {COUPON_MIN_SCORE} a thank-you starts at. "
                "A discount everyone receives is a price cut, not a thank-you."
            ],
        )

    base = next(pct for threshold, pct in COUPON_BASE if score >= threshold)
    reasons = [f"Scored {score:.2f}, which earns {base:.0f}%"]

    percent = base
    if churn_risk >= 0.4:
        percent += AT_RISK_UPLIFT
        reasons.append(
            f"Drifting away ({churn_risk:.0%} churn risk), so the offer is worth "
            f"{AT_RISK_UPLIFT:.0f}% more — this is where a discount changes a decision "
            "rather than subsidising one already made"
        )
    else:
        reasons.append(
            "Coming back regularly, so the smaller offer is the right one — the larger "
            "discount belongs with the guests who need persuading"
        )

    percent = min(COUPON_MAX_PCT, percent)
    if average_spend:
        reasons.append(f"Worth about Rs {average_spend * percent / 100:,.0f} on their usual spend")
    return Coupon(percent=round(percent, 1), reasons=reasons)


# --- making the thank-you feel like one -------------------------------------------
#
# A percentage off is the lazy thank-you. It costs the hotel real money and reads as a
# transaction, because that is what it is.
#
# The system already knows what this guest actually likes — what they ordered, where they
# spent their evenings, what they asked for twice. A perk drawn from that costs about the
# same and lands completely differently: "breakfast is on us next time" to the person who
# ordered breakfast every morning says somebody noticed. Ten percent off says the
# accounting department noticed.
#
# The discount stays as the fallback, because a guest we know nothing about should still
# get something rather than nothing.

# Which perk suits which habit. Matched on what the guest actually did, in priority order.
PERK_RULES = (
    ("breakfast", {"breakfast", "omelette", "poha", "continental"}, "Breakfast on us for your next stay"),
    ("dining", {"biryani", "butter chicken", "curry", "sandwich", "paneer", "vada"}, "Dinner for two at the all-day restaurant"),
    ("beverages", {"coffee", "chai", "tea", "lime"}, "Complimentary drinks throughout your next stay"),
)
PERK_OUTLETS = (
    ("spa", {"spa"}, "A complimentary spa treatment"),
    ("dining", {"restaurant", "dining", "bar"}, "Dinner for two at the all-day restaurant"),
)


@dataclass(slots=True)
class Perk:
    """What to actually offer. A discount unless we know something better."""

    kind: str
    description: str
    # Kept alongside so the manager can swap back to a plain discount.
    discount_pct: float
    reason: str


def perk_for(
    coupon: Coupon,
    *,
    favourite_items: list[str] | None = None,
    favourite_outlet: str | None = None,
) -> Perk:
    """Turn an earned coupon into something worth receiving."""
    if not coupon.offered:
        return Perk(
            kind="none", description="", discount_pct=0.0, reason="Nothing has been earned"
        )

    haystack = " ".join(favourite_items or []).lower()
    for kind, keywords, description in PERK_RULES:
        if any(word in haystack for word in keywords):
            matched = next(w for w in keywords if w in haystack)
            return Perk(
                kind=kind,
                description=description,
                discount_pct=coupon.percent,
                reason=f"They ordered {matched} more than anything else",
            )

    outlet = (favourite_outlet or "").lower()
    for kind, keywords, description in PERK_OUTLETS:
        if any(word in outlet for word in keywords):
            return Perk(
                kind=kind,
                description=description,
                discount_pct=coupon.percent,
                reason=f"They spent their time at the {favourite_outlet}",
            )

    return Perk(
        kind="discount",
        description=f"{coupon.percent:.0f}% off your next stay",
        discount_pct=coupon.percent,
        reason="Nothing specific known about their habits yet, so a straight discount",
    )
