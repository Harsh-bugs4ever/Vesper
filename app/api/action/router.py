from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from vesper_common.clock import utcnow
from vesper_common.db import get_session
from vesper_common.permissions import Perm
from vesper_common.security import Principal, current_user, requires

from . import dashboard as dashboard_builder
from . import service
from .models import ActionCard
from .schemas import (
    ActionStats,
    ApproveRequest,
    AuditCreate,
    AuditOut,
    CardCreate,
    CardDetail,
    CardOut,
    DismissRequest,
    OutcomeCreate,
    OutcomeOut,
    ReadinessOut,
    SnoozeRequest,
)

router = APIRouter(prefix="/cards", tags=["action-cards"])
dashboard_router = APIRouter(prefix="/dashboard", tags=["dashboard"])
learning_router = APIRouter(prefix="/learning", tags=["learning"])
audit_router = APIRouter(prefix="/audit", tags=["audit"])


def _detail(card: ActionCard) -> CardDetail:
    seconds_left = 0
    if card.undo_until:
        seconds_left = max(0, int((card.undo_until - utcnow()).total_seconds()))
    return CardDetail(
        **CardOut.model_validate(card).model_dump(),
        can_undo=card.status == "executed" and seconds_left > 0,
        undo_seconds_left=seconds_left,
    )


@router.get("", response_model=list[CardDetail])
def queue(
    kind: str | None = None,
    engine: str | None = None,
    include_decided: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> list[CardDetail]:
    """The action queue, ranked. Cards you cannot approve are not shown."""
    cards = service.list_queue(
        db, principal, kind=kind, engine=engine, include_decided=include_decided, limit=limit
    )
    return [_detail(c) for c in cards]


@router.post("", response_model=CardOut, status_code=status.HTTP_201_CREATED)
def create_card(
    body: CardCreate,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> CardOut:
    """Engines post here. Re-posting the same dedupe_key refreshes rather than duplicates."""
    payload = body.model_copy(
        update={"drivers": [d.model_dump() for d in body.drivers], "kind": body.kind.value,
                "urgency": body.urgency.value}
    )
    card = service.create_card(db, UUID(principal.property_id), payload)
    return CardOut.model_validate(card)


@router.get("/stats", response_model=ActionStats)
def stats(
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> ActionStats:
    return ActionStats(**service.stats_summary(db, UUID(principal.property_id)))


@router.get("/{card_id}", response_model=CardDetail)
def get_card(
    card_id: UUID,
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> CardDetail:
    return _detail(service.get_card(db, UUID(principal.property_id), card_id))


@router.post("/{card_id}/claim", response_model=CardDetail)
def claim(
    card_id: UUID,
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> CardDetail:
    """Hold the card while you read it. Released automatically after ten minutes."""
    return _detail(service.claim(db, principal, card_id))


@router.post("/{card_id}/release", response_model=CardDetail)
def release(
    card_id: UUID,
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> CardDetail:
    return _detail(service.release(db, principal, card_id))


@router.post("/{card_id}/approve", response_model=CardDetail)
def approve(
    card_id: UUID,
    body: ApproveRequest,
    principal: Principal = Depends(requires(Perm.CARDS_APPROVE)),
    db: Session = Depends(get_session),
) -> CardDetail:
    """Approve and execute. The per-card permission is checked on top of cards:approve."""
    return _detail(service.approve(db, principal, card_id, body.adjustments))


@router.post("/{card_id}/undo", response_model=CardDetail)
def undo(
    card_id: UUID,
    principal: Principal = Depends(requires(Perm.CARDS_APPROVE)),
    db: Session = Depends(get_session),
) -> CardDetail:
    """Safe revert, while the countdown on the toast is still running."""
    return _detail(service.undo_card(db, principal, card_id))


@router.post("/{card_id}/snooze", response_model=CardDetail)
def snooze(
    card_id: UUID,
    body: SnoozeRequest,
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> CardDetail:
    return _detail(service.snooze(db, principal, card_id, body.minutes))


@router.post("/{card_id}/dismiss", response_model=CardDetail)
def dismiss(
    card_id: UUID,
    body: DismissRequest,
    principal: Principal = Depends(requires(Perm.CARDS_DISMISS)),
    db: Session = Depends(get_session),
) -> CardDetail:
    """No, and why. Only 'not accurate' counts against the engine's confidence."""
    return _detail(service.dismiss(db, principal, card_id, body.reason.value, body.note))


@router.post("/{card_id}/outcome", response_model=OutcomeOut, status_code=status.HTTP_201_CREATED)
def score_outcome(
    card_id: UUID,
    body: OutcomeCreate,
    principal: Principal = Depends(requires(Perm.LEARNING_READ)),
    db: Session = Depends(get_session),
) -> OutcomeOut:
    """Close the loop: what actually happened, against what was predicted."""
    outcome = service.score_outcome(
        db, UUID(principal.property_id), card_id, body.actual_amount, body.notes
    )
    return OutcomeOut.model_validate(outcome)


@learning_router.get("", response_model=list[dict])
def learning(
    principal: Principal = Depends(requires(Perm.LEARNING_READ)),
    db: Session = Depends(get_session),
) -> list[dict]:
    """Per-engine accuracy, approval rate and earned confidence."""
    return service.learning_report(db, UUID(principal.property_id))


@learning_router.get("/readiness", response_model=ReadinessOut)
def readiness(
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> ReadinessOut:
    """Cold-start banner data: which engines have enough history to be believed."""
    return ReadinessOut(**service.readiness(db, UUID(principal.property_id)))


@audit_router.get("", response_model=list[AuditOut])
def list_audit(
    entity_type: str | None = None,
    actor_id: UUID | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    principal: Principal = Depends(requires(Perm.AUDIT_READ)),
    db: Session = Depends(get_session),
) -> list[AuditOut]:
    rows = service.list_audit(
        db, UUID(principal.property_id), entity_type=entity_type, actor_id=actor_id, limit=limit
    )
    return [AuditOut.model_validate(r) for r in rows]


@audit_router.post("", response_model=AuditOut, status_code=status.HTTP_201_CREATED)
def record_audit(
    body: AuditCreate,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> AuditOut:
    """Other services log their own decisions here so there is one trail, not thirteen."""
    entry = service.record_audit(
        db,
        UUID(principal.property_id),
        actor_id=UUID(principal.id) if "-" in principal.id else None,
        actor_role=principal.role,
        action=body.action,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        before=body.before,
        after=body.after,
        note=body.note,
    )
    return AuditOut.model_validate(entry)


@dashboard_router.get("", response_model=dict)
def dashboard(
    request: Request,
    live_feed: int = Query(default=15, ge=0, le=50),
    principal: Principal = Depends(requires(Perm.DASHBOARD_READ)),
    db: Session = Depends(get_session),
) -> dict:
    """Every tile on the owner dashboard in one call.

    The caller's own token is forwarded to each service, so the dashboard shows exactly
    what this person is allowed to see rather than widening to a service principal.
    Tiles that could not be loaded come back null and are named in `unavailable`.
    """
    token = request.headers.get("authorization", "").removeprefix("Bearer ").strip() or None
    return dashboard_builder.build(
        db, UUID(principal.property_id), token=token, live_feed=live_feed
    )
