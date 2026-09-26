"""Guests reviewing staff.

The mirror of `reviews.py`, pointed the other way. Same sentiment engine, same severity
correction, and a set of rules that is stricter in the places where the stakes differ.

A staff member's review of a guest decides whether that guest gets a free upgrade. A
guest's review of a staff member gets read as evidence about someone's work, and a
leaderboard actively invites that reading. So four rules the code enforces rather than
merely documents:

  * one rating per guest per staff member per stay, immutable once given;
  * a guest rating someone while their own complaint is open is recorded as such,
    never counted as a clean read;
  * a score exists only once four separate guests have spoken — below that there are
    reviews and no number;
  * nothing here produces a disciplinary output. The board recognises people; the low
    end of it says "read the comments" and stops.

Written with a room token rather than a user account, so the reviewer is a guest and the
subject is an employee. That asymmetry is the reason the module is small and separate
rather than a branch inside `reviews.py`.
"""
from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from vesper_common.clients import frontdesk, guest as guest_client, identity
from vesper_common.clock import utcnow
from vesper_common.errors import Conflict, Invalid, NotFound

from .engines import fairness, sentiment, staff_rating
from .models import GuestStaffReview, SentimentRecord, StaffPerformanceSummary

log = logging.getLogger(__name__)


def submit_review(
    db: Session,
    property_id: UUID,
    *,
    stay_id: UUID,
    guest_id: UUID,
    staff_id: UUID,
    rating: int,
    comment: str | None = None,
    request_id: UUID | None = None,
    token: str | None = None,
) -> GuestStaffReview:
    """Record one guest's rating of one staff member.

    Refused twice for the same pair on the same stay, and immutable afterwards.
    """
    if not 1 <= rating <= 5:
        raise Invalid("A rating must be between 1 and 5")

    stay = frontdesk.get(f"/stays/{stay_id}", property_id=property_id, token=token)
    if stay is None:
        raise NotFound("Stay not found")
    if UUID(stay["guest_id"]) != guest_id:
        # The room token is for this stay; it cannot be used to rate on someone else's
        # behalf, and a mismatch means the token and the body disagree.
        raise Invalid("This stay does not belong to the guest making the request")

    member = identity.get(f"/admin/users/{staff_id}", property_id=property_id, token=token)
    if member is None:
        raise NotFound("Staff member not found")

    already = db.scalars(
        select(GuestStaffReview).where(
            GuestStaffReview.stay_id == stay_id,
            GuestStaffReview.staff_id == staff_id,
            GuestStaffReview.guest_id == guest_id,
        )
    ).first()
    if already is not None:
        raise Conflict("You have already rated this team member for this stay")

    department_id = member.get("department_id")
    scored = sentiment.analyse(comment) if comment else None

    review = GuestStaffReview(
        property_id=property_id,
        stay_id=stay_id,
        guest_id=guest_id,
        staff_id=staff_id,
        department_id=UUID(department_id) if department_id else None,
        request_id=request_id,
        rating=rating,
        comment=comment,
        sentiment_score=scored.score if scored else 0.0,
        sentiment_label=scored.label if scored else "neutral",
        sentiment_method=scored.method if scored else "none",
        during_complaint=_has_open_complaint(db, property_id, guest_id),
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    rebuild_summary(db, property_id, staff_id)
    return review


def _has_open_complaint(db: Session, property_id: UUID, guest_id: UUID) -> bool:
    """Was this guest unhappy about something when they gave the rating?

    Recorded, not discounted. A guest whose air conditioning is broken may rate the
    technician honestly or may rate the hotel through them, and only a person reading
    the comment can tell which. Hiding the context would make the number look cleaner
    than it is.
    """
    complaint = db.scalars(
        select(SentimentRecord).where(
            SentimentRecord.property_id == property_id,
            SentimentRecord.guest_id == guest_id,
            SentimentRecord.score < -0.15,
        )
    ).first()
    return complaint is not None


def rebuild_summary(db: Session, property_id: UUID, staff_id: UUID) -> StaffPerformanceSummary:
    """Recompute one staff member's score from every rating guests have given them."""
    reviews = list(
        db.scalars(
            select(GuestStaffReview).where(
                GuestStaffReview.property_id == property_id,
                GuestStaffReview.staff_id == staff_id,
            )
        )
    )

    correction = _severity_correction(db, property_id, reviews)
    adjusted = {a.reviewer_id: a.adjusted_rating for a in correction.adjustments}

    now = utcnow()
    department_id = next((r.department_id for r in reviews if r.department_id), None)

    scored = staff_rating.summarise(
        [
            staff_rating.StaffReview(
                reviewer_id=str(review.guest_id),
                rating=review.rating,
                age_days=max(0.0, (now - review.created_at).total_seconds() / 86_400.0),
                comment=review.comment,
                department_id=str(review.department_id) if review.department_id else None,
                during_complaint=review.during_complaint,
            )
            for review in reviews
        ],
        department_id=str(department_id) if department_id else None,
        house_average=_house_average(db, property_id),
        adjusted=adjusted,
    )

    row = _summary_row(db, property_id, staff_id)
    row.department_id = department_id
    row.review_count = scored.review_count
    row.mean_rating = scored.mean_rating
    row.score = scored.score
    row.confidence = scored.confidence
    row.tier = scored.tier
    row.reasons = [reason[:300] for reason in scored.reasons + correction.reasons]
    row.complaint_context_reviews = scored.complaint_context_reviews
    row.thin_evidence = scored.thin_evidence
    row.deserves_recognition = scored.deserves_recognition
    row.merits_a_conversation = scored.merits_a_conversation
    row.computed_at = now

    db.commit()
    db.refresh(row)
    return row


def _severity_correction(
    db: Session, property_id: UUID, reviews: list[GuestStaffReview]
) -> fairness.Correction:
    """How hard each of these guests marks, compared with every guest at the property.

    Unchanged from the staff-reviewing-guests direction — rater severity is a property
    of the person holding the pen, not of which side of the desk they sit on.
    """
    if not reviews:
        return fairness.Correction()

    guest_ids = {review.guest_id for review in reviews}
    history = db.execute(
        select(GuestStaffReview.guest_id, GuestStaffReview.rating).where(
            GuestStaffReview.property_id == property_id,
            GuestStaffReview.guest_id.in_(guest_ids),
        )
    ).all()

    by_guest: dict[str, list[int]] = {}
    for guest_id, rating in history:
        by_guest.setdefault(str(guest_id), []).append(rating)

    profiles = fairness.reviewer_profiles(list(by_guest.items()))
    return fairness.correct(
        [(str(review.guest_id), review.rating) for review in reviews],
        profiles,
        house=_house_average(db, property_id),
    )


def _house_average(db: Session, property_id: UUID, department_id: UUID | None = None) -> float:
    """What guests at this property average across every staff member they rate."""
    query = select(func.avg(GuestStaffReview.rating)).where(GuestStaffReview.property_id == property_id)
    if department_id is not None:
        query = query.where(GuestStaffReview.department_id == department_id)
    value = db.scalar(query)
    return float(value) if value is not None else staff_rating.HOUSE_AVERAGE


def _summary_row(db: Session, property_id: UUID, staff_id: UUID) -> StaffPerformanceSummary:
    row = db.scalars(
        select(StaffPerformanceSummary).where(
            StaffPerformanceSummary.property_id == property_id,
            StaffPerformanceSummary.staff_id == staff_id,
        )
    ).first()
    if row is None:
        row = StaffPerformanceSummary(property_id=property_id, staff_id=staff_id)
        db.add(row)
    return row


def leaderboard(
    db: Session,
    property_id: UUID,
    *,
    department_id: UUID | None = None,
) -> tuple[list[StaffPerformanceSummary], list[StaffPerformanceSummary]]:
    """The performance board, and the people who are not on it.

    Two lists rather than one sorted list. Everyone without enough ratings comes back
    separately, because appending them to the bottom of a descending table reads as
    "worst", and "nobody has rated them yet" is not a ranking.
    """
    query = select(StaffPerformanceSummary).where(
        StaffPerformanceSummary.property_id == property_id
    )
    if department_id is not None:
        query = query.where(StaffPerformanceSummary.department_id == department_id)

    rows = list(db.scalars(query))
    ranked = [row for row in rows if row.score is not None]
    ranked.sort(key=lambda row: (row.score or 0.0, row.confidence), reverse=True)
    unranked = [row for row in rows if row.score is None]
    unranked.sort(key=lambda row: row.review_count, reverse=True)
    return ranked, unranked


def reviews_for_staff(
    db: Session, property_id: UUID, staff_id: UUID, *, limit: int = 50,
    department_id: UUID | None = None,
) -> list[GuestStaffReview]:
    """The comments behind one person's score, newest first."""
    query = select(GuestStaffReview).where(
        GuestStaffReview.property_id == property_id,
        GuestStaffReview.staff_id == staff_id,
    )
    if department_id is not None:
        query = query.where(GuestStaffReview.department_id == department_id)
    return list(
        db.scalars(
            query.order_by(GuestStaffReview.created_at.desc())
            .limit(limit)
        )
    )


def rateable_staff(
    db: Session, property_id: UUID, stay_id: UUID, *, token: str | None = None
) -> list[dict]:
    """Who this guest may rate, and who they have already rated.

    Only staff who actually served the stay — whoever accepted a request or an order for
    this room. A guest cannot rate someone they never met, which keeps the board about
    service given rather than about who is well known.

    Two hops on purpose: guest-service knows who served the stay but not what they are
    called, and identity knows the directory but nothing about the stay. Resolving the
    names here rather than duplicating either dataset is what stops the two disagreeing.
    """
    served = (
        guest_client.get("/guest/served-by", property_id=property_id, token=token) or []
    )
    if not served:
        return []

    rated = {
        str(row)
        for row in db.scalars(
            select(GuestStaffReview.staff_id).where(
                GuestStaffReview.property_id == property_id,
                GuestStaffReview.stay_id == stay_id,
            )
        )
    }

    people: list[dict] = []
    for entry in served:
        staff_id = entry.get("staff_id")
        if not staff_id:
            continue

        profile = identity.get(f"/admin/users/{staff_id}", property_id=property_id, token=token)
        if profile is None:
            # Someone who has left since serving the stay. Skip rather than show a
            # blank row the guest cannot make sense of.
            log.info("Skipping unknown staff %s on stay %s", staff_id, stay_id)
            continue

        people.append(
            {
                "id": staff_id,
                "name": profile.get("full_name") or "A member of our team",
                "role": profile.get("role"),
                "department_id": entry.get("department_id") or profile.get("department_id"),
                "already_rated": str(staff_id) in rated,
            }
        )

    return people
