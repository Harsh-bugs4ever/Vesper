"""Card ranking, the claim lock, the decision flow, safe undo and the learning loop."""
from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from vesper_common.clients import property_client
from vesper_common.clock import utcnow
from vesper_common.errors import Conflict, Forbidden, Invalid, NotFound
from vesper_common.events import Event, bus
from vesper_common.security import Principal

from . import executors
from .models import ActionCard, AuditEntry, CardOutcome, CardStatus, DismissReason, EngineStat, Urgency

log = logging.getLogger(__name__)

# How long a manager holds a card before it returns to the queue. Long enough to read
# the drivers and think, short enough that a closed laptop doesn't block the team.
CLAIM_TTL_MINUTES = 10
# The countdown on the undo toast.
UNDO_WINDOW_SECONDS = 600

URGENCY_WEIGHT = {
    Urgency.CRITICAL: 1.0,
    Urgency.HIGH: 0.75,
    Urgency.MEDIUM: 0.5,
    Urgency.LOW: 0.25,
}

# Impact is in rupees and unbounded; squashing it keeps a single huge number from
# burying six urgent small ones at the top of the queue.
IMPACT_SCALE = Decimal("50000")

# An engine needs this many scored outcomes before its confidence is taken at face
# value — the cold-start banner reads off the same number.
COLD_START_OUTCOMES = 10


def rank_score(confidence: float, impact: Decimal, urgency: str) -> float:
    """confidence x impact x urgency, each normalised to 0..1."""
    impact_factor = float(min(abs(Decimal(impact)) / IMPACT_SCALE, Decimal("1")))
    return round(confidence * (0.25 + 0.75 * impact_factor) * URGENCY_WEIGHT.get(urgency, 0.5), 6)


# --- creation ---------------------------------------------------------------------


def create_card(db: Session, property_id: UUID, data) -> ActionCard:
    """Raise a card, or refresh the one already standing for the same situation.

    Engines re-run on a schedule. Without the dedupe key, Tuesday's queue would hold six
    identical "bread is low" cards and a manager would stop reading any of them.
    """
    stats = _engine_stats(db, property_id, data.engine)
    confidence = round(min(1.0, max(0.0, data.confidence * stats.confidence_multiplier)), 4)

    existing = None
    if data.dedupe_key:
        existing = db.scalars(
            select(ActionCard).where(
                ActionCard.property_id == property_id,
                ActionCard.dedupe_key == data.dedupe_key,
                ActionCard.status.in_([CardStatus.PENDING, CardStatus.CLAIMED, CardStatus.SNOOZED]),
            )
        ).first()

    if existing is not None:
        existing.title = data.title
        existing.summary = data.summary
        existing.drivers = data.drivers
        existing.confidence = confidence
        existing.impact_amount = data.impact_amount
        existing.urgency = data.urgency
        existing.payload = data.payload
        existing.expires_at = data.expires_at
        existing.score = rank_score(confidence, data.impact_amount, data.urgency)
        db.commit()
        db.refresh(existing)
        return existing

    card = ActionCard(
        property_id=property_id,
        engine=data.engine,
        kind=data.kind,
        title=data.title,
        summary=data.summary,
        drivers=data.drivers,
        confidence=confidence,
        impact_amount=data.impact_amount,
        urgency=data.urgency,
        score=rank_score(confidence, data.impact_amount, data.urgency),
        department_id=data.department_id,
        required_permission=data.required_permission,
        payload=data.payload,
        expires_at=data.expires_at,
        dedupe_key=data.dedupe_key,
    )
    db.add(card)
    stats.cards_raised += 1
    db.commit()
    db.refresh(card)

    bus.publish(
        Event.CARD_CREATED,
        {
            "card_id": str(card.id),
            "engine": card.engine,
            "kind": card.kind,
            "title": card.title,
            "urgency": card.urgency,
            "score": card.score,
            "department_id": str(card.department_id) if card.department_id else None,
        },
        property_id=str(property_id),
    )
    return card


# --- reading ----------------------------------------------------------------------


def get_card(db: Session, property_id: UUID, card_id: UUID) -> ActionCard:
    query = select(ActionCard).where(
        ActionCard.id == card_id, ActionCard.property_id == property_id
    )
    card = db.scalars(query).first()
    if card is None:
        raise NotFound("Action card not found")
    return card


def list_queue(
    db: Session,
    principal: Principal,
    *,
    kind: str | None = None,
    engine: str | None = None,
    include_decided: bool = False,
    limit: int = 50,
) -> list[ActionCard]:
    """The owner's queue, highest score first.

    A card whose permission the viewer lacks is filtered out rather than shown greyed:
    an approve button you can never press is just noise on a busy morning.
    """
    property_id = UUID(principal.property_id)
    expire_stale(db, property_id)

    query = select(ActionCard).where(ActionCard.property_id == property_id)
    if include_decided:
        query = query.where(ActionCard.status != CardStatus.PENDING)
    else:
        now = utcnow()
        query = query.where(
            ActionCard.status.in_([CardStatus.PENDING, CardStatus.CLAIMED, CardStatus.SNOOZED])
        ).where((ActionCard.snoozed_until.is_(None)) | (ActionCard.snoozed_until <= now))
    if kind:
        query = query.where(ActionCard.kind == kind)
    if engine:
        query = query.where(ActionCard.engine == engine)

    cards = list(db.scalars(query.order_by(ActionCard.score.desc()).limit(limit * 2)))
    visible = [c for c in cards if principal.can(c.required_permission)]
    return visible[:limit]


def expire_stale(db: Session, property_id: UUID) -> int:
    """A rate card for a date that has passed is no longer a decision."""
    now = utcnow()
    stale = db.scalars(
        select(ActionCard).where(
            ActionCard.property_id == property_id,
            ActionCard.status.in_([CardStatus.PENDING, CardStatus.SNOOZED]),
            ActionCard.expires_at.is_not(None),
            ActionCard.expires_at < now,
        )
    ).all()
    for card in stale:
        card.status = CardStatus.EXPIRED

    # Release claims nobody followed through on.
    abandoned = db.scalars(
        select(ActionCard).where(
            ActionCard.property_id == property_id,
            ActionCard.status == CardStatus.CLAIMED,
            ActionCard.claimed_at < now - timedelta(minutes=CLAIM_TTL_MINUTES),
        )
    ).all()
    for card in abandoned:
        card.status = CardStatus.PENDING
        card.claimed_by = None
        card.claimed_at = None

    if stale or abandoned:
        db.commit()
    return len(stale) + len(abandoned)


# --- the decision flow ------------------------------------------------------------


def claim(db: Session, principal: Principal, card_id: UUID) -> ActionCard:
    """Take the card off the queue while you decide. Ten minutes, then it comes back."""
    card = get_card(db, UUID(principal.property_id), card_id)
    _assert_actionable(card)
    principal.require(card.required_permission)

    now = utcnow()
    if (
        card.status == CardStatus.CLAIMED
        and card.claimed_by
        and str(card.claimed_by) != principal.id
        and card.claimed_at
        and now - card.claimed_at < timedelta(minutes=CLAIM_TTL_MINUTES)
    ):
        raise Conflict("Another manager is looking at this card right now")

    card.status = CardStatus.CLAIMED
    card.claimed_by = UUID(principal.id)
    card.claimed_at = now
    db.commit()
    db.refresh(card)
    return card


def release(db: Session, principal: Principal, card_id: UUID) -> ActionCard:
    card = get_card(db, UUID(principal.property_id), card_id)
    if card.status == CardStatus.CLAIMED and str(card.claimed_by) == principal.id:
        card.status = CardStatus.PENDING
        card.claimed_by = None
        card.claimed_at = None
        db.commit()
        db.refresh(card)
    return card


def approve(db: Session, principal: Principal, card_id: UUID, adjustments: dict | None = None) -> ActionCard:
    """Approve, optionally adjusted, then execute.

    Approve and execute are one step on purpose: a card stuck in "approved but not
    applied" is the state nobody notices until the rate never changed.
    """
    property_id = UUID(principal.property_id)
    card = get_card(db, property_id, card_id)
    _assert_actionable(card)
    principal.require(card.required_permission)
    _assert_claimable_by(card, principal)

    if adjustments:
        _validate_adjustments(card, adjustments)
        card.adjustments = adjustments
        # A human changing the numbers changes the prediction being scored later.
        card.impact_amount = Decimal(str(adjustments.get("impact_amount", card.impact_amount)))
        card.score = rank_score(card.confidence, card.impact_amount, card.urgency)
        bus.publish(
            Event.CARD_ADJUSTED,
            {"card_id": str(card.id), "adjustments": adjustments},
            property_id=str(property_id),
            actor_id=principal.id,
        )

    before = _snapshot(card)
    card.status = CardStatus.APPROVED
    card.decided_by = UUID(principal.id)
    card.decided_at = utcnow()
    db.commit()

    shadow = shadow_mode_enabled(property_id)
    try:
        result = executors.execute(card.kind, card, shadow=shadow)
    except executors.ExecutionFailed as exc:
        # Leave it approved and say so. Silently marking it executed would put a rate
        # on the dashboard that was never actually applied.
        log.error("execution failed for card %s: %s", card.id, exc)
        _audit(db, principal, "card.execution_failed", card, before, _snapshot(card), note=str(exc))
        raise Conflict(f"Could not apply this card: {exc}") from exc

    card.status = CardStatus.EXECUTED
    card.executed_at = utcnow()
    card.was_shadow = shadow
    card.undo_payload = result.get("undo", {})
    card.undo_until = card.executed_at + timedelta(seconds=UNDO_WINDOW_SECONDS)
    stats = _engine_stats(db, property_id, card.engine)
    stats.cards_approved += 1
    db.commit()
    db.refresh(card)

    _audit(db, principal, "card.approved", card, before, _snapshot(card))
    bus.publish(
        Event.CARD_EXECUTED,
        {
            "card_id": str(card.id),
            "engine": card.engine,
            "kind": card.kind,
            "shadow": shadow,
            "impact_amount": float(card.impact_amount),
            "payload": {**card.payload, **(card.adjustments or {})},
            # staff-service creates a task when a card needs hands, not just a write.
            "task": card.payload.get("task"),
            "undo_until": card.undo_until.isoformat(),
        },
        property_id=str(property_id),
        actor_id=principal.id,
    )
    return card


def undo_card(db: Session, principal: Principal, card_id: UUID) -> ActionCard:
    """Put it back, if the window is still open."""
    property_id = UUID(principal.property_id)
    card = get_card(db, property_id, card_id)
    principal.require(card.required_permission)

    if card.status != CardStatus.EXECUTED:
        raise Conflict("Only an executed card can be undone")
    if card.undo_until is None or utcnow() > card.undo_until:
        raise Conflict("The undo window for this card has closed")

    before = _snapshot(card)
    try:
        executors.undo(card.kind, card)
    except executors.ExecutionFailed as exc:
        raise Conflict(f"Could not undo this card: {exc}") from exc

    card.status = CardStatus.UNDONE
    card.undone_at = utcnow()
    stats = _engine_stats(db, property_id, card.engine)
    stats.cards_undone += 1
    db.commit()
    db.refresh(card)

    _audit(db, principal, "card.undone", card, before, _snapshot(card))
    bus.publish(
        Event.CARD_UNDONE,
        {"card_id": str(card.id), "engine": card.engine, "kind": card.kind},
        property_id=str(property_id),
        actor_id=principal.id,
    )
    return card


def snooze(db: Session, principal: Principal, card_id: UUID, minutes: int) -> ActionCard:
    """Not now. Comes back at the chosen time with its drivers refreshed."""
    card = get_card(db, UUID(principal.property_id), card_id)
    _assert_actionable(card)
    principal.require(card.required_permission)

    before = _snapshot(card)
    card.status = CardStatus.SNOOZED
    card.snoozed_until = utcnow() + timedelta(minutes=minutes)
    card.claimed_by = None
    card.claimed_at = None
    db.commit()
    db.refresh(card)

    _audit(db, principal, "card.snoozed", card, before, _snapshot(card))
    bus.publish(
        Event.CARD_SNOOZED,
        {"card_id": str(card.id), "until": card.snoozed_until.isoformat()},
        property_id=principal.property_id,
        actor_id=principal.id,
    )
    return card


def dismiss(db: Session, principal: Principal, card_id: UUID, reason: str, note: str | None) -> ActionCard:
    """No, and here is why. The reason is what the engine learns from."""
    property_id = UUID(principal.property_id)
    card = get_card(db, property_id, card_id)
    _assert_actionable(card)
    principal.require(card.required_permission)
    if reason not in {r.value for r in DismissReason}:
        raise Invalid(f"Unknown dismiss reason '{reason}'")

    before = _snapshot(card)
    card.status = CardStatus.DISMISSED
    card.dismiss_reason = reason
    card.dismiss_note = note
    card.decided_by = UUID(principal.id)
    card.decided_at = utcnow()

    stats = _engine_stats(db, property_id, card.engine)
    stats.cards_dismissed += 1
    # "Not accurate" is the only dismissal that says the engine was wrong. Being told
    # "already handled" or "bad timing" should not make it less sure of itself.
    if reason == DismissReason.NOT_ACCURATE:
        stats.confidence_multiplier = round(max(0.5, stats.confidence_multiplier - 0.02), 4)
    db.commit()
    db.refresh(card)

    _audit(db, principal, "card.dismissed", card, before, _snapshot(card), note=note)
    bus.publish(
        Event.CARD_DISMISSED,
        {"card_id": str(card.id), "engine": card.engine, "reason": reason},
        property_id=str(property_id),
        actor_id=principal.id,
    )
    return card


# --- the learning loop ------------------------------------------------------------


def score_outcome(db: Session, property_id: UUID, card_id: UUID, actual_amount: Decimal, notes: str | None) -> CardOutcome:
    """Compare what happened against what was predicted, and adjust the engine.

    Only executed, non-shadow, non-undone cards are scored: a card nobody applied has no
    outcome to measure, and scoring it would teach the engine nothing true.
    """
    card = get_card(db, property_id, card_id)
    if card.status != CardStatus.EXECUTED or card.was_shadow:
        raise Conflict("Only a card that was really executed can be scored")
    if card.outcome is not None:
        raise Conflict("That card has already been scored")

    predicted = Decimal(card.impact_amount)
    error = abs(Decimal(actual_amount) - predicted)
    denominator = max(abs(predicted), Decimal("1"))
    accuracy = float(max(Decimal("0"), Decimal("1") - error / denominator))

    outcome = CardOutcome(
        card_id=card.id,
        property_id=property_id,
        engine=card.engine,
        predicted_amount=predicted,
        actual_amount=actual_amount,
        accuracy=round(accuracy, 4),
        was_helpful=accuracy >= 0.5,
        notes=notes,
    )
    db.add(outcome)

    stats = _engine_stats(db, property_id, card.engine)
    total = stats.outcomes_scored
    stats.mean_accuracy = round((stats.mean_accuracy * total + accuracy) / (total + 1), 4)
    stats.outcomes_scored = total + 1
    # Confidence tracks measured accuracy, but only within a band — one lucky week
    # should not make an engine twice as sure of itself.
    stats.confidence_multiplier = round(min(1.2, max(0.5, 0.5 + stats.mean_accuracy * 0.7)), 4)
    db.commit()
    db.refresh(outcome)

    bus.publish(
        Event.OUTCOME_SCORED,
        {
            "card_id": str(card.id),
            "engine": card.engine,
            "accuracy": outcome.accuracy,
            "mean_accuracy": stats.mean_accuracy,
        },
        property_id=str(property_id),
    )
    return outcome


def learning_report(db: Session, property_id: UUID) -> list[dict]:
    """The learning page: how each engine is actually doing."""
    rows = db.scalars(select(EngineStat).where(EngineStat.property_id == property_id)).all()
    report = []
    for stat in rows:
        decided = stat.cards_approved + stat.cards_dismissed
        report.append(
            {
                "engine": stat.engine,
                "cards_raised": stat.cards_raised,
                "cards_approved": stat.cards_approved,
                "cards_dismissed": stat.cards_dismissed,
                "cards_undone": stat.cards_undone,
                "approval_rate": round(stat.cards_approved / decided, 4) if decided else None,
                "outcomes_scored": stat.outcomes_scored,
                "mean_accuracy": stat.mean_accuracy,
                "confidence_multiplier": stat.confidence_multiplier,
                # The cold-start banner: say "still learning" rather than showing a
                # confident number built on four data points.
                "is_cold_start": stat.outcomes_scored < COLD_START_OUTCOMES,
                "outcomes_needed": max(0, COLD_START_OUTCOMES - stat.outcomes_scored),
            }
        )
    return sorted(report, key=lambda r: r["engine"])


def readiness(db: Session, property_id: UUID) -> dict:
    """Per-engine cold-start readiness, for the banner on every AI screen."""
    engines = learning_report(db, property_id)
    ready = [e for e in engines if not e["is_cold_start"]]
    return {
        "engines": engines,
        "ready_count": len(ready),
        "total_count": len(engines),
        "shadow_mode": shadow_mode_enabled(property_id),
    }


# --- audit ------------------------------------------------------------------------


def list_audit(
    db: Session,
    property_id: UUID,
    *,
    entity_type: str | None = None,
    actor_id: UUID | None = None,
    limit: int = 200,
) -> list[AuditEntry]:
    query = select(AuditEntry).where(AuditEntry.property_id == property_id)
    if entity_type:
        query = query.where(AuditEntry.entity_type == entity_type)
    if actor_id:
        query = query.where(AuditEntry.actor_id == actor_id)
    return list(db.scalars(query.order_by(AuditEntry.created_at.desc()).limit(limit)))


def record_audit(
    db: Session,
    property_id: UUID,
    *,
    actor_id: UUID | None,
    actor_role: str | None,
    action: str,
    entity_type: str,
    entity_id: UUID | None,
    before: dict,
    after: dict,
    note: str | None = None,
) -> AuditEntry:
    """Open to other services via the gateway, so every decision lands in one log."""
    entry = AuditEntry(
        property_id=property_id,
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before=before,
        after=after,
        note=note,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def stats_summary(db: Session, property_id: UUID) -> dict:
    """Action-queue tiles on the owner dashboard."""
    base = select(func.count()).select_from(ActionCard).where(ActionCard.property_id == property_id)
    pending = db.scalar(base.where(ActionCard.status == CardStatus.PENDING)) or 0
    executed = db.scalar(base.where(ActionCard.status == CardStatus.EXECUTED)) or 0
    total_impact = (
        db.scalar(
            select(func.coalesce(func.sum(ActionCard.impact_amount), 0)).where(
                ActionCard.property_id == property_id,
                ActionCard.status == CardStatus.EXECUTED,
                ActionCard.was_shadow.is_(False),
            )
        )
        or 0
    )
    return {
        "pending_cards": pending,
        "executed_cards": executed,
        "realised_impact": float(total_impact),
        "shadow_mode": shadow_mode_enabled(property_id),
    }


# --- helpers ----------------------------------------------------------------------


def shadow_mode_enabled(property_id: UUID | str) -> bool:
    """Read the global switch.

    If property-service cannot be reached we assume shadow mode is ON. Failing closed
    means an outage costs us an un-applied rate change, not an un-intended one.
    """
    row = property_client.get("/property", property_id=property_id)
    if row is None:
        log.warning("could not read shadow mode; assuming enabled")
        return True
    return bool((row.get("settings") or {}).get("shadow_mode", False))


def _assert_actionable(card: ActionCard) -> None:
    if card.status in {
        CardStatus.EXECUTED,
        CardStatus.UNDONE,
        CardStatus.DISMISSED,
        CardStatus.EXPIRED,
    }:
        raise Conflict(f"That card is already {card.status}")
    if card.expires_at and card.expires_at < utcnow():
        raise Conflict("That card has expired")


def _assert_claimable_by(card: ActionCard, principal: Principal) -> None:
    if (
        card.status == CardStatus.CLAIMED
        and card.claimed_by
        and str(card.claimed_by) != principal.id
        and card.claimed_at
        and utcnow() - card.claimed_at < timedelta(minutes=CLAIM_TTL_MINUTES)
    ):
        raise Forbidden("Another manager is holding this card")


def _validate_adjustments(card: ActionCard, adjustments: dict) -> None:
    """A manager may retune a card, not rewrite it into a different action."""
    editable = set((card.payload or {}).get("editable_fields") or []) | {"impact_amount"}
    illegal = sorted(set(adjustments) - editable)
    if illegal:
        raise Invalid(
            "Those fields cannot be adjusted on this card",
            details={"fields": illegal, "editable": sorted(editable)},
        )


def _engine_stats(db: Session, property_id: UUID, engine: str) -> EngineStat:
    stats = db.scalars(
        select(EngineStat).where(EngineStat.property_id == property_id, EngineStat.engine == engine)
    ).first()
    if stats is None:
        stats = EngineStat(property_id=property_id, engine=engine)
        db.add(stats)
        db.commit()
        db.refresh(stats)
    return stats


def _snapshot(card: ActionCard) -> dict:
    return {
        "status": card.status,
        "confidence": card.confidence,
        "impact_amount": float(card.impact_amount),
        "adjustments": card.adjustments,
        "was_shadow": card.was_shadow,
    }


def _audit(
    db: Session,
    principal: Principal,
    action: str,
    card: ActionCard,
    before: dict,
    after: dict,
    note: str | None = None,
) -> None:
    record_audit(
        db,
        card.property_id,
        actor_id=UUID(principal.id) if principal.id and "-" in principal.id else None,
        actor_role=principal.role,
        action=action,
        entity_type="action_card",
        entity_id=card.id,
        before=before,
        after=after,
        note=note,
    )
