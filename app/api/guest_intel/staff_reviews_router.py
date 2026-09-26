"""Guests reviewing staff: submit, read back, rank.

Three audiences, and the split between them is the point.

  * **Guests** write, with a room token, and may read back only what they themselves
    wrote. They never see a score, theirs or anyone's.
  * **Staff** may see their own summary and nobody else's. Feedback about your own work
    is yours; a ranking of your colleagues is not.
  * **Managers** see the board.

The write route is the only thing in this service mounted behind a guest token, so it
is deliberately the narrowest: the stay comes from the token rather than the body, and
a guest can only rate staff who actually served them.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm
from app.api.identity.models import User
from vesper_common.errors import NotFound
from vesper_common.security import Principal, current_guest, current_user, requires

from . import staff_reviews
from .models import GuestStaffReview, StaffPerformanceSummary
from sqlalchemy import select
from .engines import staff_rating
from .schemas import (
    RateableStaff,
    StaffPerformanceBoard,
    StaffPerformanceDetail,
    StaffPerformanceOut,
    StaffReviewCreate,
    StaffReviewForGuest,
    StaffReviewOut,
)

router = APIRouter(prefix="/staff-reviews", tags=["staff-reviews"])


def _performance_visible(db: Session, principal: Principal, staff_id: UUID,
                         department_id: UUID | None) -> bool:
    if principal.role in {"gm", "service"}:
        return True
    if not principal.can_see_department(department_id):
        return False
    # The persisted score is property-wide for a person. If reviews span departments,
    # only GM and the employee may read it until each department has its own score.
    outside = db.scalar(select(GuestStaffReview.id).where(
        GuestStaffReview.property_id == UUID(principal.property_id),
        GuestStaffReview.staff_id == staff_id,
        GuestStaffReview.department_id.is_distinct_from(department_id),
    ).limit(1))
    return outside is None


def _bearer(request: Request) -> str | None:
    return request.headers.get("authorization", "").removeprefix("Bearer ").strip() or None


# --- Guest-facing (room token) ------------------------------------------------------


@router.get("/rateable", response_model=list[RateableStaff])
def rateable(
    request: Request,
    principal: Principal = Depends(current_guest),
    db: Session = Depends(get_session),
) -> list[RateableStaff]:
    """Who this guest may rate: the people who actually served this stay."""
    if not principal.stay_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This token is not tied to a stay")

    members = staff_reviews.rateable_staff(
        db,
        UUID(principal.property_id),
        UUID(principal.stay_id),
        token=_bearer(request),
    )
    return [RateableStaff.model_validate(member) for member in members]


@router.post("", response_model=StaffReviewForGuest, status_code=status.HTTP_201_CREATED)
def submit(
    body: StaffReviewCreate,
    request: Request,
    principal: Principal = Depends(current_guest),
    db: Session = Depends(get_session),
) -> StaffReviewForGuest:
    """Rate a member of staff who served you.

    One per person per stay, and final once given. The stay and the guest come from the
    room token, never from the body — otherwise a token for room 204 could be used to
    leave ratings against someone else's stay.
    """
    if not principal.stay_id or not principal.guest_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This token is not tied to a stay")

    review = staff_reviews.submit_review(
        db,
        UUID(principal.property_id),
        stay_id=UUID(principal.stay_id),
        guest_id=UUID(principal.guest_id),
        staff_id=body.staff_id,
        rating=body.rating,
        comment=body.comment,
        request_id=body.request_id,
        token=_bearer(request),
    )
    return StaffReviewForGuest.model_validate(review)


@router.get("/mine", response_model=list[StaffReviewForGuest])
def my_ratings(
    principal: Principal = Depends(current_guest),
    db: Session = Depends(get_session),
) -> list[StaffReviewForGuest]:
    """What this guest has already submitted on this stay."""
    if not principal.stay_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This token is not tied to a stay")

    from sqlalchemy import select

    from .models import GuestStaffReview

    rows = db.scalars(
        select(GuestStaffReview)
        .where(
            GuestStaffReview.property_id == UUID(principal.property_id),
            GuestStaffReview.stay_id == UUID(principal.stay_id),
        )
        .order_by(GuestStaffReview.created_at.desc())
    )
    return [StaffReviewForGuest.model_validate(row) for row in rows]


# --- Staff-facing -------------------------------------------------------------------


@router.get("/me", response_model=StaffPerformanceOut)
def my_performance(
    principal: Principal = Depends(requires(Perm.STAFF_REVIEW_READ_OWN)),
    db: Session = Depends(get_session),
) -> StaffPerformanceOut:
    """Your own summary.

    Your score and the reasons behind it, without the individual comments — those name
    a guest alongside an opinion, and handing them over unmediated is how feedback
    turns into a grudge at the front desk. A manager can walk you through them.
    """
    row = staff_reviews.rebuild_summary(db, UUID(principal.property_id), UUID(principal.id))
    return StaffPerformanceOut.model_validate(row)


# --- Manager-facing -----------------------------------------------------------------


@router.get("/board", response_model=StaffPerformanceBoard)
def board(
    department_id: UUID | None = Query(default=None),
    principal: Principal = Depends(requires(Perm.STAFF_REVIEW_READ)),
    db: Session = Depends(get_session),
) -> StaffPerformanceBoard:
    """The performance board for the property, or for one department.

    Scores are only loosely comparable across departments — a concierge and a night
    auditor meet very different numbers of guests in very different moods — so filter
    by department before reading too much into the order.
    """
    property_id = UUID(principal.property_id)
    scope = principal.scoped_department(department_id)
    ranked, unranked = staff_reviews.leaderboard(db, property_id, department_id=scope)
    ranked = [row for row in ranked if _performance_visible(db, principal, row.staff_id, row.department_id)]
    unranked = [row for row in unranked if _performance_visible(db, principal, row.staff_id, row.department_id)]

    return StaffPerformanceBoard(
        ranked=[StaffPerformanceOut.model_validate(row) for row in ranked],
        unranked=[StaffPerformanceOut.model_validate(row) for row in unranked],
        house_average=staff_reviews._house_average(db, property_id, scope),
        minimum_reviews_for_score=staff_rating.MIN_REVIEWS_FOR_SCORE,
    )


@router.get("/staff/{staff_id}", response_model=StaffPerformanceDetail)
def staff_detail(
    staff_id: UUID,
    principal: Principal = Depends(requires(Perm.STAFF_REVIEW_READ)),
    db: Session = Depends(get_session),
) -> StaffPerformanceDetail:
    """One person's score and the reviews behind it."""
    property_id = UUID(principal.property_id)
    user = db.get(User, staff_id)
    if user is None or not any(str(a.property_id) == principal.property_id for a in user.assignments):
        raise NotFound("Staff member not found")
    row = db.scalars(select(StaffPerformanceSummary).where(
        StaffPerformanceSummary.property_id == property_id,
        StaffPerformanceSummary.staff_id == staff_id,
    )).first()
    if row is None or not _performance_visible(db, principal, staff_id, row.department_id):
        raise NotFound("Staff performance record not found")
    reviews = staff_reviews.reviews_for_staff(db, property_id, staff_id,
                                              department_id=row.department_id)

    detail = StaffPerformanceDetail.model_validate(row)
    detail.reviews = [StaffReviewOut.model_validate(review) for review in reviews]
    return detail


@router.post("/staff/{staff_id}/recompute", response_model=StaffPerformanceOut)
def recompute(
    staff_id: UUID,
    principal: Principal = Depends(requires(Perm.STAFF_REVIEW_READ)),
    db: Session = Depends(get_session),
) -> StaffPerformanceOut:
    """Rebuild one person's summary from their ratings."""
    user = db.get(User, staff_id)
    if user is None or not any(str(a.property_id) == principal.property_id for a in user.assignments):
        raise NotFound("Staff member not found")
    summary = db.scalars(select(StaffPerformanceSummary).where(
        StaffPerformanceSummary.property_id == UUID(principal.property_id),
        StaffPerformanceSummary.staff_id == staff_id,
    )).first()
    if summary is None or not _performance_visible(db, principal, staff_id, summary.department_id):
        raise NotFound("Staff performance record not found")
    row = staff_reviews.rebuild_summary(db, UUID(principal.property_id), staff_id)
    if not _performance_visible(db, principal, staff_id, row.department_id):
        raise NotFound("Staff performance record not found")
    return StaffPerformanceOut.model_validate(row)
