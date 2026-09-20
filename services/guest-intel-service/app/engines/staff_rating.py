"""Turning guests' ratings of staff into a defensible performance score.

The mirror of `guest_rating`, pointed the other way, and the more dangerous of the two.
A guest score decides whether someone gets a free upgrade. A staff score gets read as
evidence about a person's work, and a leaderboard invites exactly that reading. Four
ways the naive version — average the stars, sort descending — hurts real people:

  * **Volume is not quality.** A concierge who meets forty guests a week collects forty
    chances to be rated; a night auditor meets four. Sorting on a raw mean puts the
    front of house on top every time and calls it performance. A Bayesian average pulls
    thin samples toward the house average instead of letting them fly.
  * **Exposure is not merit.** Staff whose job is to deliver bad news — the person who
    says the upgrade is unavailable — rate lower than staff who hand out towels, for
    reasons that are about the role and not the worker. Scores are comparable within a
    department and only loosely across them, so `Score` carries its department and the
    ranking is department-aware.
  * **Guests mark on different scales.** The same `fairness` correction the staff side
    uses applies here unchanged: a guest who gives everyone a 3 says nothing about the
    person they rated.
  * **Recency matters and staleness lies.** Someone who struggled in March and has been
    excellent since should not be ranked on March. Older ratings decay toward
    irrelevance rather than counting forever at full weight.

What this deliberately does not do: produce a number anyone should act on alone. There
is no "bottom performer" output, no automatic flag to HR, and `is_scored` stays false
until enough separate guests have spoken. It reports a score and the reasons behind it.
"""
from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field

# What a new staff member's score is pulled toward before they have a record.
HOUSE_AVERAGE = 4.0
# How many imaginary average reviews sit behind everyone. Higher than the guest side
# (2.5) on purpose: it takes more evidence to say something about a person's work than
# about one stay.
PRIOR_WEIGHT = 4.0
# Below this many distinct guests, there is no score at all — only the reviews.
MIN_REVIEWS_FOR_SCORE = 4
# Below this many, say so even once a score exists.
THIN_EVIDENCE_BELOW = 8
# Ratings older than this count for half as much.
RECENCY_HALF_LIFE_DAYS = 60.0
# Beyond this, a rating is old news and contributes almost nothing.
MAX_AGE_DAYS = 365.0

# Recognition threshold. Above the midpoint on purpose: being recognised should mean
# being memorable, not merely inoffensive.
RECOGNITION_THRESHOLD = 4.3
# Below this, a manager should read the comments — never an automatic consequence.
ATTENTION_THRESHOLD = 3.0


@dataclass(slots=True)
class StaffReview:
    """One guest's rating of one staff member."""

    reviewer_id: str
    rating: int
    age_days: float = 0.0
    comment: str | None = None
    department_id: str | None = None
    # Set when the guest raised a complaint this staff member handled. A rating given
    # in the middle of a problem is information, but it is not a clean read on the
    # person who was sent to fix it.
    during_complaint: bool = False


@dataclass(slots=True)
class Score:
    review_count: int
    mean_rating: float | None
    # The recency- and severity-weighted Bayesian average the ranking sorts on.
    score: float | None
    confidence: float
    tier: str
    department_id: str | None = None
    reasons: list[str] = field(default_factory=list)
    complaint_context_reviews: int = 0
    thin_evidence: bool = False
    is_scored: bool = False

    @property
    def deserves_recognition(self) -> bool:
        """True only on a real score, comfortably clear, on more than thin evidence."""
        return (
            self.is_scored
            and self.score is not None
            and self.score >= RECOGNITION_THRESHOLD
            and not self.thin_evidence
        )

    @property
    def merits_a_conversation(self) -> bool:
        """A manager should read the comments. Explicitly not a disciplinary trigger."""
        return self.is_scored and self.score is not None and self.score <= ATTENTION_THRESHOLD


def recency_weight(age_days: float) -> float:
    """Exponential decay with a 60-day half-life, floored at zero past a year."""
    if age_days >= MAX_AGE_DAYS:
        return 0.0
    if age_days <= 0:
        return 1.0
    return math.pow(0.5, age_days / RECENCY_HALF_LIFE_DAYS)


def tier_for(score: float) -> str:
    if score >= RECOGNITION_THRESHOLD:
        return "exceptional"
    if score >= 3.9:
        return "strong"
    if score >= 3.3:
        return "steady"
    if score > ATTENTION_THRESHOLD:
        return "developing"
    return "needs_support"


def summarise(
    reviews: list[StaffReview],
    *,
    department_id: str | None = None,
    house_average: float = HOUSE_AVERAGE,
    adjusted: dict[str, float] | None = None,
) -> Score:
    """Aggregate one staff member's guest ratings into a score and its reasoning.

    `adjusted` optionally supplies severity-corrected ratings keyed by reviewer id, from
    `fairness.correct`. When absent the raw ratings are used and the score says so.
    """
    if not reviews:
        return Score(
            review_count=0,
            mean_rating=None,
            score=None,
            confidence=0.0,
            tier="unrated",
            department_id=department_id,
            reasons=["No guest has rated this person yet"],
        )

    # One guest, one voice: a guest who rated the same person on three nights should not
    # outweigh three different guests. Keep each reviewer's most recent rating.
    freshest: dict[str, StaffReview] = {}
    for review in reviews:
        seen = freshest.get(review.reviewer_id)
        if seen is None or review.age_days < seen.age_days:
            freshest[review.reviewer_id] = review
    distinct = list(freshest.values())

    raw_mean = statistics.fmean(review.rating for review in distinct)
    complaint_context = sum(1 for review in distinct if review.during_complaint)
    reasons: list[str] = []

    if len(distinct) < MIN_REVIEWS_FOR_SCORE:
        return Score(
            review_count=len(distinct),
            mean_rating=round(raw_mean, 2),
            score=None,
            confidence=0.0,
            tier="insufficient",
            department_id=department_id,
            reasons=[
                f"{len(distinct)} guest rating"
                f"{'' if len(distinct) == 1 else 's'} so far — {MIN_REVIEWS_FOR_SCORE} "
                "different guests are needed before this counts as a score"
            ],
            complaint_context_reviews=complaint_context,
            thin_evidence=True,
        )

    # Weight each rating by how recent it is, and use the severity-corrected value where
    # the fairness engine had enough evidence to offer one.
    weighted_total = 0.0
    weight_total = 0.0
    for review in distinct:
        weight = recency_weight(review.age_days)
        if weight <= 0:
            continue
        value = (adjusted or {}).get(review.reviewer_id, float(review.rating))
        weighted_total += value * weight
        weight_total += weight

    if weight_total <= 0:
        return Score(
            review_count=len(distinct),
            mean_rating=round(raw_mean, 2),
            score=None,
            confidence=0.0,
            tier="stale",
            department_id=department_id,
            reasons=["Every rating is over a year old — too stale to score"],
            complaint_context_reviews=complaint_context,
            thin_evidence=True,
        )

    weighted_mean = weighted_total / weight_total

    # Bayesian shrinkage toward the house average, using the effective (recency-weighted)
    # sample size rather than the raw count — five ratings from last year should not buy
    # the same confidence as five from last week.
    score = (weighted_mean * weight_total + house_average * PRIOR_WEIGHT) / (
        weight_total + PRIOR_WEIGHT
    )
    confidence = weight_total / (weight_total + PRIOR_WEIGHT)
    thin = len(distinct) < THIN_EVIDENCE_BELOW

    if adjusted:
        reasons.append("Adjusted for how harshly each guest marks")
    if thin:
        reasons.append(
            f"Based on {len(distinct)} guests — enough to score, not enough to rank confidently"
        )
    if complaint_context:
        reasons.append(
            f"{complaint_context} of these ratings were given while the guest had an open "
            "complaint — read the comments before drawing conclusions"
        )
    stale = sum(1 for review in distinct if recency_weight(review.age_days) < 0.25)
    if stale:
        reasons.append(f"{stale} rating{'' if stale == 1 else 's'} older than four months count for little")

    return Score(
        review_count=len(distinct),
        mean_rating=round(raw_mean, 2),
        score=round(score, 2),
        confidence=round(confidence, 2),
        tier=tier_for(score),
        department_id=department_id,
        reasons=reasons,
        complaint_context_reviews=complaint_context,
        thin_evidence=thin,
        is_scored=True,
    )


def rank(scored: list[tuple[str, Score]], *, within_department: bool = True) -> list[tuple[str, Score]]:
    """Order staff for the leaderboard.

    Unscored people are not ranked last — they are not ranked at all, and the caller is
    expected to list them separately rather than at the bottom of a table that reads as
    worst-to-best.

    With `within_department`, ties break toward the better-evidenced score, so a
    confident 4.4 outranks a shaky one.
    """
    rankable = [(sid, s) for sid, s in scored if s.is_scored and s.score is not None]
    rankable.sort(key=lambda pair: (pair[1].score or 0.0, pair[1].confidence), reverse=True)
    return rankable


def unranked(scored: list[tuple[str, Score]]) -> list[tuple[str, Score]]:
    """The people `rank` left out, and why — shown beside the board, never below it."""
    return [(sid, s) for sid, s in scored if not (s.is_scored and s.score is not None)]
