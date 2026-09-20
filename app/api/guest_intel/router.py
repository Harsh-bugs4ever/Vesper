from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm
from vesper_common.security import Principal, current_guest, current_user, requires

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
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> SentimentOut:
    """Score a comment. Normally driven by the rating event, exposed for backfills."""
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
        **service.sentiment_summary(db, UUID(principal.property_id), days=days)
    )


@router.get("/sentiment/trend", response_model=list[dict])
def sentiment_trend(
    days: int = Query(default=30, ge=1, le=365),
    principal: Principal = Depends(requires(Perm.GUESTS_READ)),
    db: Session = Depends(get_session),
) -> list[dict]:
    """Department sentiment over time — the trend chart."""
    return service.department_trend(db, UUID(principal.property_id), days=days)


@router.get("/dna/{guest_id}", response_model=GuestDnaOut)
def get_dna(
    guest_id: UUID,
    principal: Principal = Depends(requires(Perm.GUESTS_READ)),
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
    principal: Principal = Depends(requires(Perm.GUESTS_READ)),
    db: Session = Depends(get_session),
) -> GuestDnaOut:
    row = service.build_dna(
        db, UUID(principal.property_id), guest_id, token=_bearer(request)
    )
    return GuestDnaOut.model_validate(row)


@router.get("/at-risk", response_model=list[GuestDnaOut])
def at_risk(
    principal: Principal = Depends(requires(Perm.GUESTS_READ)),
    db: Session = Depends(get_session),
) -> list[GuestDnaOut]:
    """Guests drifting away, most at risk first."""
    rows = service.at_risk_guests(db, UUID(principal.property_id))
    return [GuestDnaOut.model_validate(r) for r in rows]


@router.get("/offers", response_model=list[OfferOut])
def list_offers(
    status_filter: str | None = Query(default=None, alias="status"),
    principal: Principal = Depends(requires(Perm.GUESTS_READ)),
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
def concierge_models(_: Principal = Depends(requires(Perm.SETTINGS_WRITE))) -> list[str]:
    """What the configured Groq key can actually serve, for the settings page."""
    return concierge.available_models()


@router.post("/concierge/ask", response_model=ConciergeOut)
def guest_ask(
    body: AskRequest,
    principal: Principal = Depends(current_guest),
    db: Session = Depends(get_session),
) -> ConciergeOut:
    """The guest chat. Rate limited per stay; answers only from the knowledge base."""
    message = service.ask(
        db,
        UUID(principal.property_id),
        body.question,
        stay_id=UUID(principal.stay_id) if principal.stay_id else None,
        guest_id=UUID(principal.guest_id) if principal.guest_id else None,
        user_id=None,
        asked_by_staff=False,
    )
    return ConciergeOut.model_validate(message)


@router.get("/concierge/history", response_model=list[ConciergeOut])
def guest_history(
    principal: Principal = Depends(current_guest), db: Session = Depends(get_session)
) -> list[ConciergeOut]:
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
    message = service.handle_escalation(
        db, UUID(principal.property_id), message_id, actor_id=UUID(principal.id)
    )
    return ConciergeOut.model_validate(message)
