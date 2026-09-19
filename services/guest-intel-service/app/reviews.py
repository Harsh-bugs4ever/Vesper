"""Staff reviews of guests.

The mirror of a guest rating the hotel: same sentiment engine, opposite direction, and a
stricter set of rules around it. This is subjective opinion about a named person,
recorded by people the guest cannot see, feeding a decision about how that person is
treated. Kept in its own module rather than buried in service.py for that reason — it is
the part of the product most worth being able to find and audit.

Four rules the code enforces rather than merely documents:

  * one review per person per stay, immutable once written;
  * a conflict of interest is flagged, never silently discounted;
  * a reward needs an objective signal as well as a good score;
  * nothing reaches the guest without a human approving it.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from vesper_common.clients import action, frontdesk, property_client
from vesper_common.clock import local_today, utcnow
from vesper_common.errors import Conflict, Invalid, NotFound
from vesper_common.permissions import Perm

from .engines import guest_rating, sentiment
from .models import SentimentRecord, StaffGuestReview, StayReviewSummary
from .rag import review_summary

log = logging.getLogger(__name__)


def submit_review(
    db: Session,
    property_id: UUID,
    *,
    stay_id: UUID,
    reviewer_id: UUID,
    department_id: UUID | None,
    rating: int,
    comment: str | None,
    token: str | None = None,
) -> StaffGuestReview:
    """Record one staff member's review of a stay.

    Refused twice from the same person, and immutable afterwards. A review that can be
    revised once the manager has read the summary is not a record of what anyone thought
    at the time.
    """
    if not 1 <= rating <= 5:
        raise Invalid("A rating must be between 1 and 5")

    stay = frontdesk.get(f"/stays/{stay_id}", property_id=property_id, token=token)
    if stay is None:
        raise NotFound("Stay not found")

    already = db.scalars(
        select(StaffGuestReview).where(
            StaffGuestReview.stay_id == stay_id,
            StaffGuestReview.reviewed_by == reviewer_id,
        )
    ).first()
    if already is not None:
        raise Conflict("You have already reviewed this stay")

    guest_id = UUID(stay["guest_id"])
    scored = sentiment.analyse(comment) if comment else None
    review = StaffGuestReview(
        property_id=property_id,
        stay_id=stay_id,
        guest_id=guest_id,
        reviewed_by=reviewer_id,
        department_id=department_id,
        rating=rating,
        comment=comment,
        sentiment_score=scored.score if scored else 0.0,
        sentiment_label=scored.label if scored else "neutral",
        sentiment_method=scored.method if scored else "none",
        is_conflicted=_is_conflicted(db, property_id, guest_id, department_id),
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    rebuild_summary(db, property_id, stay_id, token=token)
    return review


def _is_conflicted(
    db: Session, property_id: UUID, guest_id: UUID, department_id: UUID | None
) -> bool:
    """Did this guest complain about the reviewer's own department?

    Flagged, not filtered. Dropping the review would hide the conflict from the manager;
    showing it lets them weigh it, which is the honest version. This is the retaliation
    path — the waiter a guest complained about rating them down — and the only defence
    that works is making it visible.
    """
    if department_id is None:
        return False
    complaint = db.scalars(
        select(SentimentRecord).where(
            SentimentRecord.property_id == property_id,
            SentimentRecord.guest_id == guest_id,
            SentimentRecord.department_id == department_id,
            SentimentRecord.score < -0.15,
        )
    ).first()
    return complaint is not None


def rebuild_summary(
    db: Session, property_id: UUID, stay_id: UUID, *, token: str | None = None
) -> StayReviewSummary:
    """Recompute one stay's score and summary from its reviews."""
    reviews = list(
        db.scalars(
            select(StaffGuestReview).where(
                StaffGuestReview.property_id == property_id,
                StaffGuestReview.stay_id == stay_id,
            )
        )
    )

    scored = guest_rating.summarise(
        [
            guest_rating.Review(
                reviewer_id=str(r.reviewed_by),
                department_id=str(r.department_id) if r.department_id else None,
                rating=r.rating,
                comment=r.comment,
                conflicted=r.is_conflicted,
            )
            for r in reviews
        ]
    )

    signals = _guest_signals(db, property_id, stay_id, reviews, token)
    blended = guest_rating.combine(scored, signals)

    row = _summary_row(db, property_id, stay_id, reviews, token)
    row.final_score = blended.final_score
    row.engagement_bonus = blended.engagement_bonus
    row.guest_sentiment = blended.guest_sentiment
    row.possible_retaliation = blended.possible_retaliation
    row.review_count = scored.review_count
    row.mean_rating = scored.mean_rating
    row.score = scored.score
    row.confidence = scored.confidence
    row.tier = blended.tier
    row.departments = scored.departments
    # The blended reasons include the staff ones plus anything the guest's own behaviour
    # added, so a manager reads one list rather than reconciling two.
    row.reasons = [reason[:300] for reason in blended.reasons]
    row.conflicted_reviews = scored.conflicted_reviews

    # Only summarise once there is a real picture — a single note needs no condensing,
    # and running it through a model would add nothing but a chance to distort it.
    if scored.is_scored:
        names = _department_names(property_id, token)
        notes = [
            (names.get(str(r.department_id), "Staff"), r.comment) for r in reviews if r.comment
        ]
        summary = review_summary.summarise(notes)
        row.summary_text = summary.text or None
        row.summary_method = summary.method

    row.computed_at = utcnow()
    db.commit()
    db.refresh(row)
    return row


def _guest_signals(
    db: Session,
    property_id: UUID,
    stay_id: UUID,
    reviews: list[StaffGuestReview],
    token: str | None,
) -> guest_rating.GuestSignals:
    """What the guest themselves did — ratings left, how they felt, what they spent.

    Complaints are counted so the retaliation pattern can be spotted, never so they can
    be held against the guest.
    """
    guest_id = reviews[0].guest_id if reviews else None
    if guest_id is None:
        stay = frontdesk.get(f"/stays/{stay_id}", property_id=property_id, token=token) or {}
        if not stay.get("guest_id"):
            return guest_rating.GuestSignals()
        guest_id = UUID(stay["guest_id"])

    theirs = list(
        db.scalars(
            select(SentimentRecord).where(
                SentimentRecord.property_id == property_id,
                SentimentRecord.guest_id == guest_id,
            )
        )
    )
    stay = frontdesk.get(f"/stays/{stay_id}", property_id=property_id, token=token) or {}
    profile = (
        frontdesk.get(f"/visits/{guest_id}/profile", property_id=property_id, token=token) or {}
    )
    mean = sum(r.score for r in theirs) / len(theirs) if theirs else 0.0
    return guest_rating.GuestSignals(
        ratings_given=len(theirs),
        mean_sentiment=round(mean, 4),
        complaints=sum(1 for r in theirs if r.score < -0.15),
        spend=float(stay.get("folio_total") or 0),
        visits=int(profile.get("total_visits") or 0),
    )


def _summary_row(
    db: Session,
    property_id: UUID,
    stay_id: UUID,
    reviews: list[StaffGuestReview],
    token: str | None,
) -> StayReviewSummary:
    row = db.scalars(
        select(StayReviewSummary).where(
            StayReviewSummary.property_id == property_id,
            StayReviewSummary.stay_id == stay_id,
        )
    ).first()
    if row is not None:
        return row

    stay = frontdesk.get(f"/stays/{stay_id}", property_id=property_id, token=token) or {}
    guest_id = stay.get("guest_id") or (str(reviews[0].guest_id) if reviews else None)
    if guest_id is None:
        raise NotFound("Cannot summarise a stay with no guest")
    row = StayReviewSummary(
        property_id=property_id,
        stay_id=stay_id,
        guest_id=UUID(guest_id),
        room_number=stay.get("room_number"),
        departs_on=_departure_date(stay),
    )
    db.add(row)
    db.flush()
    return row


def _departure_date(stay: dict):
    checkout = (stay.get("booking") or {}).get("check_out_date") or stay.get("check_out_date")
    if not checkout:
        return None
    from datetime import date

    try:
        return date.fromisoformat(checkout)
    except (TypeError, ValueError):
        return None


def _department_names(property_id: UUID, token: str | None) -> dict[str, str]:
    departments = (
        property_client.get("/property/departments", property_id=property_id, token=token) or []
    )
    return {d["id"]: d["name"] for d in departments}


def stay_reviews(db: Session, property_id: UUID, stay_id: UUID) -> list[StaffGuestReview]:
    """Every individual review, for a manager only.

    Attribution is deliberate: somebody acting on a score should be able to see who said
    what. Staff never see each other's reviews, which is what keeps them candid.
    """
    return list(
        db.scalars(
            select(StaffGuestReview)
            .where(
                StaffGuestReview.property_id == property_id,
                StaffGuestReview.stay_id == stay_id,
            )
            .order_by(StaffGuestReview.created_at)
        )
    )


def get_summary(db: Session, property_id: UUID, stay_id: UUID) -> StayReviewSummary:
    row = db.scalars(
        select(StayReviewSummary).where(
            StayReviewSummary.property_id == property_id,
            StayReviewSummary.stay_id == stay_id,
        )
    ).first()
    if row is None:
        raise NotFound("No reviews recorded for this stay yet")
    return row


def _churn_risk(db: Session, property_id: UUID, guest_id: UUID) -> float:
    """How likely this guest is to drift away, from the retention engine.

    Zero when we have never profiled them — a guest we know nothing about gets the
    smaller offer, which is the right way round.
    """
    from .models import GuestDna

    row = db.scalars(
        select(GuestDna).where(
            GuestDna.property_id == property_id, GuestDna.guest_id == guest_id
        )
    ).first()
    return float(row.risk_score) if row else 0.0


def _as_score(row: StayReviewSummary) -> guest_rating.Score:
    return guest_rating.Score(
        review_count=row.review_count,
        mean_rating=row.mean_rating,
        score=row.final_score if row.final_score is not None else row.score,
        confidence=row.confidence,
        tier=row.tier,
        departments=row.departments,
        reasons=list(row.reasons),
        conflicted_reviews=row.conflicted_reviews,
        is_scored=row.score is not None,
    )


def ranked_summaries(
    db: Session, property_id: UUID, *, days: int = 1
) -> list[StayReviewSummary]:
    """The manager's checkout-morning list, best regarded first.

    Stays with too few reviews sort last rather than being hidden: "three people still
    owe a review" is something a manager wants to see, and dropping them would make the
    list look complete when it is not.
    """
    horizon = local_today() + timedelta(days=days)
    rows = list(
        db.scalars(
            select(StayReviewSummary).where(
                StayReviewSummary.property_id == property_id,
                (StayReviewSummary.departs_on.is_(None))
                | (StayReviewSummary.departs_on <= horizon),
            )
        )
    )
    order = {
        stay_id: index
        for index, (stay_id, _) in enumerate(
            guest_rating.rank([(str(row.stay_id), _as_score(row)) for row in rows])
        )
    }
    return sorted(rows, key=lambda r: order.get(str(r.stay_id), len(order)))


def consider_reward(
    db: Session, property_id: UUID, stay_id: UUID, *, token: str | None = None
) -> dict | None:
    """Put a thank-you in front of a manager when a guest has earned one.

    Sends nothing itself. It raises an action card, and somebody holding offers:approve
    decides — the same path every other suggestion in the product takes.
    """
    row = get_summary(db, property_id, stay_id)
    if row.reward_card_id is not None:
        return None

    stay = frontdesk.get(f"/stays/{stay_id}", property_id=property_id, token=token) or {}
    profile = (
        frontdesk.get(f"/visits/{row.guest_id}/profile", property_id=property_id, token=token)
        or {}
    )
    spend = float(stay.get("folio_total") or 0)
    worth_it, reasons = guest_rating.deserves_reward(
        _as_score(row), objective_spend=spend, visits=int(profile.get("total_visits") or 0)
    )
    if worth_it and row.possible_retaliation:
        # Never auto-propose off a score that may be payback for a complaint.
        log.info("holding the reward for stay %s: possible retaliation flagged", stay_id)
        return None
    if not worth_it:
        log.info("no reward for stay %s: %s", stay_id, reasons[-1])
        return None

    # How well regarded they were decides whether there is a coupon; how likely they are
    # to drift away decides how big it is. The churn score comes from the retention
    # engine, which is already tracking exactly that.
    churn = _churn_risk(db, property_id, row.guest_id)
    coupon = guest_rating.coupon_for(
        row.final_score if row.final_score is not None else row.score,
        churn_risk=churn,
        average_spend=float(profile.get("average_spend") or spend),
    )
    if not coupon.offered:
        log.info("no coupon for stay %s: %s", stay_id, coupon.reasons[0])
        return None
    reasons = reasons + coupon.reasons

    room = row.room_number or "?"
    card = {
        "engine": "guest_intel",
        "kind": "retention_offer",
        "title": f"Thank room {room} with {coupon.percent:.0f}% off their next stay",
        "summary": (
            f"Staff rated this stay {row.score:.2f} across {row.review_count} reviews. "
            f"{row.summary_text or ''}"
        ).strip()[:600],
        "required_permission": Perm.OFFERS_APPROVE.value,
        "drivers": [
            {"label": "Why", "detail": reason[:200], "weight": 0.3} for reason in reasons[:4]
        ],
        "confidence": row.confidence,
        # What a returning guest of this value is worth, not what the perk costs.
        "impact_amount": float(profile.get("average_spend") or spend),
        "urgency": "high",
        "payload": {
            "stay_id": str(stay_id),
            "guest_id": str(row.guest_id),
            "review_score": row.score,
            "discount_pct": coupon.percent,
            # The manager can retune the offer; they cannot rewrite who it is for.
            "editable_fields": ["discount_pct", "impact_amount"],
            "task": {
                "title": f"Arrange a thank-you for room {room} before checkout",
                "description": row.summary_text,
                "department_id": None,
                "priority": "high",
                "due_in_minutes": 120,
            },
        },
        "dedupe_key": f"guest_thanks:{stay_id}",
    }
    if action.post("/cards", property_id=property_id, json=card) is None:
        return None

    # Marked so the same stay is never proposed twice.
    row.reward_card_id = stay_id
    db.commit()
    return card
