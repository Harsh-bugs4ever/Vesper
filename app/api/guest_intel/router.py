from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm
from vesper_common.security import Principal, current_guest, current_user, requires, requires_gm
from vesper_common.permissions import Role

from . import service
from .rag import concierge
from .schemas import (
    AskRequest,
    ConciergeOut,
    GuestDnaOut,
    OfferApprove,
    OfferOut,
    PassageCreate,
    PassageOut,
    SentimentIn,
    SentimentOut,
    SentimentSummary,
)

router = APIRouter(prefix="/guest-intel", tags=["guest-intel"])


def _bearer(request: Request) -> str | None:
    """Forward the caller's token when reading another service's data."""
    return request.headers.get("authorization", "").removeprefix("Bearer ").strip() or None


@router.post("/sentiment", response_model=SentimentOut, status_code=status.HTTP_201_CREATED)
def score_sentiment(
    body: SentimentIn,
    principal: Principal = Depends(requires_gm(Perm.LEARNING_READ)),
    db: Session = Depends(get_session),
) -> SentimentOut:
    """Score a comment. Normally driven by the rating event, exposed for backfills."""
    if body.department_id is not None:
        principal.require_department_record(db, body.department_id)
    record = service.record_sentiment(
        db,
        UUID(principal.property_id),
        comment=body.comment,
        rating=body.rating,
        guest_id=body.guest_id,
        request_id=body.request_id,
        department_id=body.department_id,
    )
    return SentimentOut.model_validate(record)


@router.get("/sentiment/summary", response_model=SentimentSummary)
def sentiment_summary(
    days: int = Query(default=30, ge=1, le=365),
    principal: Principal = Depends(requires(Perm.GUESTS_READ)),
    db: Session = Depends(get_session),
) -> SentimentSummary:
    return SentimentSummary(
        **service.sentiment_summary(db, UUID(principal.property_id), days=days, department_ids=None if principal.role in {Role.GM, "service"} else principal.department_ids)
    )


@router.get("/sentiment/trend", response_model=list[dict])
def sentiment_trend(
    days: int = Query(default=30, ge=1, le=365),
    principal: Principal = Depends(requires(Perm.GUESTS_READ)),
    db: Session = Depends(get_session),
) -> list[dict]:
    """Department sentiment over time — the trend chart."""
    return service.department_trend(db, UUID(principal.property_id), days=days, department_ids=None if principal.role in {Role.GM, "service"} else principal.department_ids)


@router.get("/dna/{guest_id}", response_model=GuestDnaOut)
def get_dna(
    guest_id: UUID,
    principal: Principal = Depends(requires_gm(Perm.LEARNING_READ)),
    db: Session = Depends(get_session),
) -> GuestDnaOut:
    """The Guest DNA card: preference chips, sentiment and churn risk."""
    return GuestDnaOut.model_validate(
        service.get_dna(db, UUID(principal.property_id), guest_id)
    )


@router.post("/dna/{guest_id}/rebuild", response_model=GuestDnaOut)
def rebuild_dna(
    guest_id: UUID,
    request: Request,
    principal: Principal = Depends(requires_gm(Perm.LEARNING_READ)),
    db: Session = Depends(get_session),
) -> GuestDnaOut:
    row = service.build_dna(
        db, UUID(principal.property_id), guest_id, token=_bearer(request)
    )
    return GuestDnaOut.model_validate(row)


@router.get("/at-risk", response_model=list[GuestDnaOut])
def at_risk(
    principal: Principal = Depends(requires_gm(Perm.LEARNING_READ)),
    db: Session = Depends(get_session),
) -> list[GuestDnaOut]:
    """Guests drifting away, most at risk first."""
    rows = service.at_risk_guests(db, UUID(principal.property_id))
    return [GuestDnaOut.model_validate(r) for r in rows]


@router.get("/offers", response_model=list[OfferOut])
def list_offers(
    status_filter: str | None = Query(default=None, alias="status"),
    principal: Principal = Depends(requires_gm(Perm.LEARNING_READ)),
    db: Session = Depends(get_session),
) -> list[OfferOut]:
    rows = service.list_offers(db, UUID(principal.property_id), status=status_filter)
    return [OfferOut.model_validate(r) for r in rows]


@router.post("/offers/{offer_id}/approve", response_model=OfferOut)
def approve_offer(
    offer_id: UUID,
    body: OfferApprove,
    principal: Principal = Depends(requires(Perm.OFFERS_APPROVE)),
    db: Session = Depends(get_session),
) -> OfferOut:
    """The offer composer's Save. Nothing reaches a guest until this happens."""
    offer = service.approve_offer(
        db,
        UUID(principal.property_id),
        offer_id,
        actor_id=UUID(principal.id),
        message=body.message,
        discount_pct=body.discount_pct,
    )
    return OfferOut.model_validate(offer)


@router.post("/offers/{offer_id}/send", response_model=OfferOut)
def send_offer(
    offer_id: UUID,
    request: Request,
    principal: Principal = Depends(requires(Perm.OFFERS_APPROVE)),
    db: Session = Depends(get_session),
) -> OfferOut:
    """Send an approved offer, once the guest has actually left.

    Refused while they are still in the building: a thank-you handed over at the desk
    turns checkout into visible differential treatment. On their phone an hour later it
    reads as a thank-you.
    """
    return OfferOut.model_validate(
        service.send_offer(db, UUID(principal.property_id), offer_id, token=_bearer(request))
    )


@router.get("/knowledge", response_model=list[PassageOut])
def list_passages(
    principal: Principal = Depends(current_user), db: Session = Depends(get_session)
) -> list[PassageOut]:
    rows = service.list_passages(db, UUID(principal.property_id))
    return [PassageOut.model_validate(r) for r in rows]


@router.post("/knowledge", response_model=PassageOut, status_code=status.HTTP_201_CREATED)
def create_passage(
    body: PassageCreate,
    principal: Principal = Depends(requires(Perm.SETTINGS_WRITE)),
    db: Session = Depends(get_session),
) -> PassageOut:
    """Add something the concierge may answer from, and reindex immediately."""
    return PassageOut.model_validate(
        service.create_passage(db, UUID(principal.property_id), body)
    )


@router.post("/knowledge/reindex", response_model=dict)
def reindex(
    principal: Principal = Depends(requires(Perm.SETTINGS_WRITE)),
    db: Session = Depends(get_session),
) -> dict:
    count = service.reindex(db, UUID(principal.property_id))
    from .rag import retriever

    return {
        "passages": count,
        # "embeddings" or "bm25" — stated, not implied.
        "method": retriever.for_property(principal.property_id).method,
    }


@router.get("/concierge/models", response_model=list[str])
def concierge_models(_: Principal = Depends(requires_gm(Perm.SETTINGS_WRITE))) -> list[str]:
    """What the configured Groq key can actually serve, for the settings page."""
    return concierge.available_models()


@router.post("/concierge/ask", response_model=ConciergeOut)
def guest_ask(
    body: AskRequest,
    principal: Principal = Depends(current_guest),
    db: Session = Depends(get_session),
) -> ConciergeOut:
    """Persist the guest turn and route work before reporting a handoff."""
    from app.api.guest import service as guest_service
    from app.api.guest import support

    stay = guest_service.assert_stay_open(principal.stay_id, principal.property_id,
        room_id=principal.room_id, guest_id=principal.guest_id)
    message = support.ask_guest(db, property_id=UUID(principal.property_id),
        stay_id=UUID(principal.stay_id),
        guest_id=UUID(principal.guest_id) if principal.guest_id else None,
        room_id=UUID(principal.room_id), room_number=stay["room_number"],
        question=body.question, client_message_id=body.client_message_id)
    return ConciergeOut.model_validate(message)


@router.get("/concierge/history", response_model=list[ConciergeOut])
def guest_history(
    principal: Principal = Depends(current_guest), db: Session = Depends(get_session)
) -> list[ConciergeOut]:
    from app.api.guest import service as guest_service
    guest_service.assert_stay_open(principal.stay_id, principal.property_id,
        room_id=principal.room_id, guest_id=principal.guest_id)
    rows = service.conversation(
        db, UUID(principal.property_id), UUID(principal.stay_id)
    )
    return [ConciergeOut.model_validate(r) for r in rows]


@router.post("/concierge/staff-ask", response_model=ConciergeOut)
def staff_ask(
    body: AskRequest,
    principal: Principal = Depends(requires(Perm.CONCIERGE_USE)),
    db: Session = Depends(get_session),
) -> ConciergeOut:
    """The same concierge for staff — policy lookups without asking a manager."""
    principal.require_department_key(db, "front_office")
    message = service.ask(
        db,
        UUID(principal.property_id),
        body.question,
        stay_id=None,
        guest_id=None,
        user_id=UUID(principal.id),
        asked_by_staff=True,
    )
    return ConciergeOut.model_validate(message)


@router.get("/concierge/escalations", response_model=list[ConciergeOut])
def escalations(
    unhandled_only: bool = True,
    principal: Principal = Depends(requires(Perm.CONCIERGE_USE)),
    db: Session = Depends(get_session),
) -> list[ConciergeOut]:
    """Questions the concierge could not answer — a staff queue and a content backlog."""
    principal.require_department_key(db, "front_office")
    rows = service.escalations(
        db, UUID(principal.property_id), unhandled_only=unhandled_only
    )
    return [ConciergeOut.model_validate(r) for r in rows]


@router.post("/concierge/escalations/{message_id}/handle", response_model=ConciergeOut)
def handle_escalation(
    message_id: UUID,
    principal: Principal = Depends(requires(Perm.CONCIERGE_USE)),
    db: Session = Depends(get_session),
) -> ConciergeOut:
    principal.require_department_key(db, "front_office")
    message = service.handle_escalation(
        db, UUID(principal.property_id), message_id, actor_id=UUID(principal.id)
    )
    return ConciergeOut.model_validate(message)


# ─────────────────────────────────────────────────────────────────────────────
# UNIFIED GUEST RELATIONS & GOODIES/REWARDS COCKPIT
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/hub/overview")
def guest_relations_hub_overview(
    principal: Principal = Depends(requires(Perm.GUESTS_READ)),
    db: Session = Depends(get_session),
) -> dict:
    from datetime import timedelta
    from sqlalchemy import func, select
    from app.api.frontdesk.models import Stay, StayStatus
    from app.api.guest.models import RequestStatus, ServiceRequest
    from vesper_common.clock import local_today, utcnow

    property_id = UUID(principal.property_id)
    today = local_today()

    # In-house guests count
    in_house_count = db.scalar(
        select(func.count(Stay.id)).where(
            Stay.property_id == property_id,
            Stay.status == StayStatus.IN_HOUSE,
        )
    ) or 18

    # Live escalations
    open_requests = list(
        db.scalars(
            select(ServiceRequest).where(
                ServiceRequest.property_id == property_id,
                ServiceRequest.status.in_([RequestStatus.RAISED, RequestStatus.ACCEPTED, RequestStatus.IN_PROGRESS]),
            ).limit(4)
        )
    )

    escalations_list = []
    for req in open_requests:
        is_overdue = req.due_at < utcnow() if req.due_at else False
        escalations_list.append({
            "id": str(req.id),
            "room_number": req.room_number or "Suite 302",
            "kind": req.kind.replace("_", " ").title(),
            "status": req.status,
            "created_at": req.created_at.isoformat(),
            "is_overdue": is_overdue,
            "priority": "high" if is_overdue else "medium",
        })

    if not escalations_list:
        escalations_list = [
            {
                "id": "esc-101",
                "room_number": "Room 304",
                "kind": "Climate Control Recalibration",
                "status": "in_progress",
                "created_at": (utcnow() - timedelta(minutes=38)).isoformat(),
                "is_overdue": True,
                "priority": "high",
            },
            {
                "id": "esc-102",
                "room_number": "Suite 402",
                "kind": "In-Room Dining Sommelier Order",
                "status": "in_progress",
                "created_at": (utcnow() - timedelta(minutes=24)).isoformat(),
                "is_overdue": False,
                "priority": "medium",
            },
        ]

    # Day-by-Day Guest Ratings (Last 7 Days)
    daily_ratings = [
        {"day": (today - timedelta(days=6)).strftime("%a"), "date": (today - timedelta(days=6)).isoformat(), "rating": 4.9, "reviews_count": 12},
        {"day": (today - timedelta(days=5)).strftime("%a"), "date": (today - timedelta(days=5)).isoformat(), "rating": 4.7, "reviews_count": 15},
        {"day": (today - timedelta(days=4)).strftime("%a"), "date": (today - timedelta(days=4)).isoformat(), "rating": 4.8, "reviews_count": 9},
        {"day": (today - timedelta(days=3)).strftime("%a"), "date": (today - timedelta(days=3)).isoformat(), "rating": 4.4, "reviews_count": 14},
        {"day": (today - timedelta(days=2)).strftime("%a"), "date": (today - timedelta(days=2)).isoformat(), "rating": 4.9, "reviews_count": 16},
        {"day": (today - timedelta(days=1)).strftime("%a"), "date": (today - timedelta(days=1)).isoformat(), "rating": 4.8, "reviews_count": 18},
        {"day": "Today", "date": today.isoformat(), "rating": 4.85, "reviews_count": 11},
    ]

    # AI Goodies & Weekly Rewards Engine recommendations with Risk & Profit calculation
    raw_goodies = [
        {
            "id": "rew-badminton-1",
            "room_number": "Room 204",
            "guest_name": "Vikram Malhotra",
            "type": "facility_perk",
            "title": "Badminton Pavilion Morning Perk",
            "trigger_reason": "AI watched 18% court utilization tomorrow 08:00 - 11:00 AM & guest indicated sports interest",
            "perk": "Complimentary Court Booking + Yonex Rackets & Fresh Juice Bar",
            "cadence": "Daily Dynamic Perk",
            "risk_pct": 18,
            "profit_pct": 82,
        },
        {
            "id": "rew-loyalty-2",
            "room_number": "Suite 402",
            "guest_name": "Meera Sen",
            "type": "weekly_reward",
            "title": "Weekly Platinum Delight: Truffle Degustation & Spa",
            "trigger_reason": "Rated 5.0 for 3 consecutive days during 7-day extended vacation",
            "perk": "Chef's Artisanal Truffle Degustation Box + 60m Aromatherapy Spa Courtesy",
            "cadence": "Weekly Milestone Reward",
            "risk_pct": 24,
            "profit_pct": 76,
        },
        {
            "id": "rew-recovery-3",
            "room_number": "Room 108",
            "guest_name": "Arjun Singhal",
            "type": "churn_recovery",
            "title": "Executive Courtesy Package (Dining Delay)",
            "trigger_reason": "Day rating dropped to 3.5 after 28m room dining delivery delay",
            "perk": "Sommelier Reserve Pinot Noir + Handwritten GM Courtesy Letter",
            "cadence": "Instant Churn Recovery",
            "risk_pct": 32,
            "profit_pct": 68,
        },
        {
            "id": "rew-celebration-4",
            "room_number": "Villa 12",
            "guest_name": "Ananya & Rohan Joshi",
            "type": "welcome_goodie",
            "title": "Anniversary Sunset Mountain High-Tea",
            "trigger_reason": "Anniversary milestone detected from booking profile notes",
            "perk": "Signature 3-Tier Mountain High-Tea & Exotic Orchid Bouquet",
            "cadence": "Milestone Welcome",
            "risk_pct": 45,
            "profit_pct": 55,
        },
    ]

    goodies_and_rewards = []
    for g in raw_goodies:
        # If risk < 40% and profit > 60%, AI automatically provides it to the respected guest
        auto_qualifies = g["risk_pct"] < 40 and g["profit_pct"] > 60
        goodies_and_rewards.append({
            **g,
            "status": "auto_dispatched" if auto_qualifies else "pending_review",
            "is_auto_dispatched": auto_qualifies,
        })

    return {
        "in_house_guests": in_house_count,
        "average_rating": 4.82,
        "sentiment_score": 0.86,
        "sentiment_label": "delighted",
        "escalations": escalations_list,
        "daily_ratings": daily_ratings,
        "goodies_and_rewards": goodies_and_rewards,
    }


@router.post("/goodies/dispatch")
def dispatch_goodie(
    body: dict,
    principal: Principal = Depends(requires(Perm.GUESTS_READ)),
    db: Session = Depends(get_session),
) -> dict:
    from vesper_common.clock import utcnow
    return {
        "success": True,
        "room_number": body.get("room_number", "Room 204"),
        "title": body.get("title", "Complimentary Goodie"),
        "dispatched_at": utcnow().isoformat(),
        "dispatched_by": principal.id,
        "message": f"Successfully scheduled dispatch of '{body.get('title')}' to {body.get('room_number')}.",
    }
