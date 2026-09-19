"""Correcting for how hard a particular reviewer marks.

Some people rate everyone a 3. Some rate everyone a 5. That says something about the
reviewer and nothing about the guest, and until it is accounted for it lands on the guest
as if it were evidence.

It matters on both sides of the desk. A guest whose stay happened to be covered by the
floor's harshest reviewer loses a thank-you they earned. And a reviewer whose ratings sit
a long way from everyone else's is worth a quiet word from their manager — not because
they are wrong, but because a scale only means something if people share it.

The correction is the standard one for rater severity: pull each reviewer's ratings
toward the house average in proportion to how far their own average sits from it, and how
much evidence there is that the gap is real rather than a run of difficult guests.

Two things it deliberately does not do:

  * **It never silently rewrites a review.** The stored rating is what the person gave.
    The adjustment happens at aggregation time and is reported, so a manager reading the
    summary can see both numbers.
  * **It never corrects on thin evidence.** Below a handful of reviews a low average is
    far more likely to be three difficult guests than a harsh marker.
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass, field

# Below this many reviews from one person, assume the guests explain the average, not
# the reviewer.
MIN_REVIEWS_TO_JUDGE_A_REVIEWER = 6
# A gap smaller than this is ordinary variation between reasonable people.
NOTABLE_GAP = 0.6
# Never move a rating by more than this. The reviewer met the guest and we did not; the
# correction is a thumb on the scale, not a replacement for their judgement.
MAX_ADJUSTMENT = 0.75


@dataclass(slots=True)
class ReviewerProfile:
    reviewer_id: str
    reviews_given: int
    mean_rating: float

    def gap_from(self, house_average: float) -> float:
        return self.mean_rating - house_average

    def is_judgeable(self) -> bool:
        return self.reviews_given >= MIN_REVIEWS_TO_JUDGE_A_REVIEWER


@dataclass(slots=True)
class Adjustment:
    reviewer_id: str
    raw_rating: float
    adjusted_rating: float
    # Negative when the reviewer marks harder than the house and the rating was lifted.
    shift: float
    note: str


@dataclass(slots=True)
class Correction:
    adjustments: list[Adjustment] = field(default_factory=list)
    # Reviewers far enough from the house average to be worth a manager's attention.
    outlier_reviewers: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)

    @property
    def applied(self) -> bool:
        return any(abs(a.shift) > 0.01 for a in self.adjustments)


def house_average(profiles: list[ReviewerProfile], fallback: float = 3.5) -> float:
    """What this property's reviewers average, weighted by how much each has rated."""
    judgeable = [p for p in profiles if p.reviews_given > 0]
    if not judgeable:
        return fallback
    total = sum(p.mean_rating * p.reviews_given for p in judgeable)
    count = sum(p.reviews_given for p in judgeable)
    return total / count if count else fallback


def correct(
    ratings: list[tuple[str, int]],
    profiles: dict[str, ReviewerProfile],
    *,
    house: float | None = None,
) -> Correction:
    """Adjust one stay's ratings for reviewer severity.

    `ratings` is (reviewer_id, rating) for this stay; `profiles` is what each of those
    reviewers has done across every stay.
    """
    if not ratings:
        return Correction()

    average = house if house is not None else house_average(list(profiles.values()))
    correction = Correction()

    for reviewer_id, raw in ratings:
        profile = profiles.get(reviewer_id)
        if profile is None or not profile.is_judgeable():
            correction.adjustments.append(
                Adjustment(
                    reviewer_id=reviewer_id,
                    raw_rating=float(raw),
                    adjusted_rating=float(raw),
                    shift=0.0,
                    note="Not enough reviews from this person to judge their scale",
                )
            )
            continue

        gap = profile.gap_from(average)
        if abs(gap) < NOTABLE_GAP:
            correction.adjustments.append(
                Adjustment(
                    reviewer_id=reviewer_id,
                    raw_rating=float(raw),
                    adjusted_rating=float(raw),
                    shift=0.0,
                    note="Rates in line with everyone else",
                )
            )
            continue

        # Move against the reviewer's own bias, capped.
        shift = max(-MAX_ADJUSTMENT, min(MAX_ADJUSTMENT, -gap))
        adjusted = max(1.0, min(5.0, raw + shift))
        direction = "harder" if gap < 0 else "more generously"
        correction.adjustments.append(
            Adjustment(
                reviewer_id=reviewer_id,
                raw_rating=float(raw),
                adjusted_rating=round(adjusted, 3),
                shift=round(adjusted - raw, 3),
                note=(
                    f"Rates {abs(gap):.1f} {direction} than the house average of "
                    f"{average:.1f} across {profile.reviews_given} reviews"
                ),
            )
        )
        if profile.reviewer_id not in correction.outlier_reviewers:
            correction.outlier_reviewers.append(profile.reviewer_id)

    if correction.applied:
        moved = [a for a in correction.adjustments if abs(a.shift) > 0.01]
        correction.reasons.append(
            f"{len(moved)} rating(s) adjusted for how hard that reviewer usually marks; "
            "the original ratings are unchanged and still shown"
        )
    return correction


def adjusted_ratings(correction: Correction) -> list[float]:
    return [a.adjusted_rating for a in correction.adjustments]


def reviewer_profiles(rows: list[tuple[str, list[int]]]) -> dict[str, ReviewerProfile]:
    """Build profiles from (reviewer_id, every rating they have ever given)."""
    return {
        reviewer_id: ReviewerProfile(
            reviewer_id=reviewer_id,
            reviews_given=len(ratings),
            mean_rating=statistics.fmean(ratings) if ratings else 0.0,
        )
        for reviewer_id, ratings in rows
        if ratings
    }
