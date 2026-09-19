"""Staff reviews of guests: submit, read, rank, reward.

Two audiences, and the split between them is the point. Staff submit and can see only
their own; managers see everything including who said what. Nothing here is reachable
from a guest token — the routes all sit behind a staff permission, and none of them is
mounted on the `/guest` prefix the QR session can reach.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm
from vesper_common.security import Principal, current_user, requires

from . import prompts, reviews
from .schemas import (
    GuestReviewCreate,
    GuestReviewOut,
    StayReviewDetail,
    StayReviewSummaryOut,
)

router = APIRouter(prefix="/guest-reviews", tags=["guest-reviews"])


def _bearer(request: Request) -> str | None:
    return request.headers.get("authorization", "").removeprefix("Bearer ").strip() or None


@router.post("/stays/{stay_id}", response_model=GuestReviewOut, status_code=status.HTTP_201_CREATED)
def submit(
    stay_id: UUID,
    body: GuestReviewCreate,
    request: Request,
    principal: Principal = Depends(requires(Perm.GUEST_REVIEW_WRITE)),
    db: Session = Depends(get_session),
) -> GuestReviewOut:
    """Record your own view of a guest's stay.

    One per person per stay, and final once submitted. The guest never sees it.
    """
    review = reviews.submit_review(
        db,
        UUID(principal.property_id),
        stay_id=stay_id,
        reviewer_id=UUID(principal.id),
        department_id=UUID(principal.department_id) if principal.department_id else None,
        rating=body.rating,
        comment=body.comment,
        token=_bearer(request),
    )
    return GuestReviewOut.model_validate(review)


@router.get("/mine", response_model=list[GuestReviewOut])
def my_reviews(
    principal: Principal = Depends(requires(Perm.GUEST_REVIEW_WRITE)),
    db: Session = Depends(get_session),
) -> list[GuestReviewOut]:
    """What you have already submitted.

    Deliberately only your own: staff seeing each other's ratings is how a score stops
    being candid and starts being a consensus.
    """
    from sqlalchemy import select

    from .models import StaffGuestReview

    rows = db.scalars(
        select(StaffGuestReview)
        .where(
            StaffGuestReview.property_id == UUID(principal.property_id),
            StaffGuestReview.reviewed_by == UUID(principal.id),
        )
        .order_by(StaffGuestReview.created_at.desc())
        .limit(100)
    )
    return [GuestReviewOut.model_validate(r) for r in rows]


@router.get("/departing", response_model=list[StayReviewSummaryOut])
def departing(
    days: int = Query(default=1, ge=0, le=14),
    principal: Principal = Depends(requires(Perm.GUEST_REVIEW_READ)),
    db: Session = Depends(get_session),
) -> list[StayReviewSummaryOut]:
    """The manager's checkout list, best regarded first.

    Stays without enough reviews sort last rather than being hidden, so "three people
    still owe a review" stays visible instead of looking like a complete picture.
    """
    rows = reviews.ranked_summaries(db, UUID(principal.property_id), days=days)
    return [StayReviewSummaryOut.model_validate(r) for r in rows]


@router.get("/stays/{stay_id}", response_model=StayReviewDetail)
def stay_detail(
    stay_id: UUID,
    principal: Principal = Depends(requires(Perm.GUEST_REVIEW_READ)),
    db: Session = Depends(get_session),
) -> StayReviewDetail:
    """The summary plus every individual review behind it.

    Attributed on purpose: anyone acting on a score should be able to see who said what,
    and a conflicted review should be obvious rather than silently weighted away.
    """
    summary = reviews.get_summary(db, UUID(principal.property_id), stay_id)
    individual = reviews.stay_reviews(db, UUID(principal.property_id), stay_id)
    return StayReviewDetail(
        **StayReviewSummaryOut.model_validate(summary).model_dump(),
        reviews=[GuestReviewOut.model_validate(r) for r in individual],
    )


@router.post("/stays/{stay_id}/recompute", response_model=StayReviewSummaryOut)
def recompute(
    stay_id: UUID,
    request: Request,
    principal: Principal = Depends(requires(Perm.GUEST_REVIEW_READ)),
    db: Session = Depends(get_session),
) -> StayReviewSummaryOut:
    """Rebuild the score and re-summarise. Normally automatic on each new review."""
    row = reviews.rebuild_summary(
        db, UUID(principal.property_id), stay_id, token=_bearer(request)
    )
    return StayReviewSummaryOut.model_validate(row)


@router.post("/stays/{stay_id}/consider-reward", response_model=dict)
def consider_reward(
    stay_id: UUID,
    request: Request,
    principal: Principal = Depends(requires(Perm.GUEST_REVIEW_READ)),
    db: Session = Depends(get_session),
) -> dict:
    """Raise a thank-you card if this guest has earned one.

    Sends nothing. A good score alone is not enough — there has to be an objective signal
    too, and then somebody with offers:approve still has to say yes.
    """
    card = reviews.consider_reward(
        db, UUID(principal.property_id), stay_id, token=_bearer(request)
    )
    return {"raised": card is not None, "card": card}


@router.post("/prompt-departing", response_model=dict)
def prompt_departing(
    principal: Principal = Depends(current_user),
) -> dict:
    """Ask everyone who dealt with a departing guest for their view.

    Runs on a timer; exposed so a demo can trigger it.
    """
    asked = prompts.prompt_departing_stays(principal.property_id)
    return {"asked": asked}
