"""Sentiment scoring, Guest DNA, retention offers and the concierge."""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from vesper_common.clients import action, frontdesk, guest as guest_client, property_client
from vesper_common.clock import local_today, utcnow
from vesper_common.errors import Conflict, Invalid, NotFound
from vesper_common.permissions import Perm

from .engines import dna, sentiment
from .models import (
    ConciergeMessage,
    GuestDna,
    KnowledgePassage,
    OfferStatus,
    RetentionOffer,
    SentimentRecord,
)
from .rag import concierge, retriever

log = logging.getLogger(__name__)

# How many questions one stay may ask per hour. The Groq free tier is the binding
# constraint, and one bored guest should not exhaust it for the whole resort.
CONCIERGE_RATE_LIMIT = 20
CONCIERGE_RATE_WINDOW = timedelta(hours=1)

# Cards below this risk score are not worth an owner's attention.
OFFER_CARD_MIN_RISK = 0.5


# --- sentiment --------------------------------------------------------------------


def record_sentiment(
    db: Session,
    property_id: UUID,
    *,
    comment: str | None,
    rating: int | None,
    guest_id: UUID | None,
    request_id: UUID | None,
    department_id: UUID | None,
) -> SentimentRecord:
    """Score one piece of feedback.

    A comment is scored by the model. A bare star rating is not run through it at all —
    converting 1-5 to a signed score is arithmetic, and pretending otherwise would put a
    fake "analysed" label on the record.
    """
    if comment and comment.strip():
        result = sentiment.analyse(comment)
        score, label, confidence, method = (
            result.score,
            result.label,
            result.confidence,
            result.method,
        )
        themes = dna.detect_themes(comment) if score < -0.15 else []
    elif rating is not None:
        score = sentiment.from_rating(rating)
        label, confidence, method, themes = sentiment.to_label(score), 0.9, "rating_only", []
    else:
        raise Invalid("Nothing to score — send a comment, a rating, or both")

    record = SentimentRecord(
        property_id=property_id,
        guest_id=guest_id,
        request_id=request_id,
        department_id=department_id,
        comment=comment,
        rating=rating,
        score=score,
        label=label,
        confidence=confidence,
        method=method,
        themes=themes,
        occurred_on=local_today(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def department_trend(db: Session, property_id: UUID, *, days: int = 30) -> list[dict]:
    """Average sentiment per department per day — the trend chart on the guests page."""
    since = local_today() - timedelta(days=days)
    rows = db.execute(
        select(
            SentimentRecord.department_id,
            SentimentRecord.occurred_on,
            func.avg(SentimentRecord.score).label("average"),
            func.count(SentimentRecord.id).label("samples"),
        )
        .where(
            SentimentRecord.property_id == property_id,
            SentimentRecord.occurred_on >= since,
        )
        .group_by(SentimentRecord.department_id, SentimentRecord.occurred_on)
        .order_by(SentimentRecord.occurred_on)
    ).all()

    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        key = str(row.department_id) if row.department_id else "unassigned"
        grouped[key].append(
            {
                "date": row.occurred_on.isoformat(),
                "average_sentiment": round(float(row.average), 4),
                "samples": row.samples,
            }
        )
    return [{"department_id": k, "points": v} for k, v in grouped.items()]


def sentiment_summary(db: Session, property_id: UUID, *, days: int = 30) -> dict:
    since = local_today() - timedelta(days=days)
    records = db.scalars(
        select(SentimentRecord).where(
            SentimentRecord.property_id == property_id, SentimentRecord.occurred_on >= since
        )
    ).all()
    if not records:
        return {"samples": 0, "average_sentiment": 0.0, "label": "neutral", "top_themes": []}

    average = sum(r.score for r in records) / len(records)
    theme_counts: dict[str, int] = defaultdict(int)
    for record in records:
        for theme in record.themes or []:
            theme_counts[theme] += 1
    return {
        "samples": len(records),
        "average_sentiment": round(average, 4),
        "label": sentiment.to_label(average),
        "negative_share": round(sum(1 for r in records if r.score < -0.15) / len(records), 4),
        "top_themes": [
            {"theme": t, "mentions": c}
            for t, c in sorted(theme_counts.items(), key=lambda i: i[1], reverse=True)[:5]
        ],
    }


# --- guest DNA --------------------------------------------------------------------


def build_dna(db: Session, property_id: UUID, guest_id: UUID, *, token: str | None = None) -> GuestDna:
    """Rebuild one guest's profile from their whole history."""
    requests = guest_client.get(
        f"/guests/{guest_id}/requests", property_id=property_id, token=token
    ) or []
    profile_data = frontdesk.get(
        f"/visits/{guest_id}/profile", property_id=property_id, token=token
    ) or {}
    visits = frontdesk.get(f"/visits/{guest_id}", property_id=property_id, token=token) or []

    orders = [
        {
            "items": r.get("items", []),
            "hour": _hour_of(r.get("created_at")),
        }
        for r in requests
        if r.get("kind") == "room_service"
    ]

    stored = db.scalars(
        select(SentimentRecord).where(
            SentimentRecord.property_id == property_id, SentimentRecord.guest_id == guest_id
        )
    ).all()
    ratings = [
        {"sentiment_score": r.score, "comment": r.comment, "rating": r.rating} for r in stored
    ]

    profile = dna.build_profile(
        orders=orders,
        ratings=ratings,
        visits=visits,
        total_stays=int(profile_data.get("total_stays") or 0),
    )

    visit_dates = [date.fromisoformat(v["occurred_on"]) for v in visits if v.get("occurred_on")]
    recent_sentiment = (
        sum(r.score for r in stored[-5:]) / len(stored[-5:]) if stored else 0.0
    )
    risk = dna.assess_risk(
        visit_dates=visit_dates,
        today=local_today(),
        average_spend=float(profile_data.get("average_spend") or 0),
        recent_sentiment=recent_sentiment,
        segment=profile.segment,
    )

    row = db.scalars(
        select(GuestDna).where(GuestDna.property_id == property_id, GuestDna.guest_id == guest_id)
    ).first()
    if row is None:
        row = GuestDna(property_id=property_id, guest_id=guest_id)
        db.add(row)

    row.preferences = [
        {"key": p.key, "label": p.label, "detail": p.detail, "confidence": p.confidence}
        for p in profile.preferences
    ]
    row.favourite_items = profile.favourite_items
    row.average_sentiment = profile.average_sentiment
    row.sentiment_label = profile.sentiment_label
    row.complaint_themes = profile.complaint_themes
    row.segment = profile.segment
    row.observations = profile.observations
    row.is_at_risk = risk.is_at_risk
    row.risk_score = risk.risk_score
    row.risk_reasons = risk.reasons
    row.typical_gap_days = risk.typical_gap_days
    row.days_since_last_visit = risk.days_since_last_visit
    row.computed_at = utcnow()
    db.commit()
    db.refresh(row)

    if risk.is_at_risk and risk.suggested_offer:
        _ensure_offer(db, property_id, guest_id, risk, profile_data)
    return row


def get_dna(db: Session, property_id: UUID, guest_id: UUID) -> GuestDna:
    row = db.scalars(
        select(GuestDna).where(GuestDna.property_id == property_id, GuestDna.guest_id == guest_id)
    ).first()
    if row is None:
        raise NotFound("No profile built for this guest yet")
    return row


def at_risk_guests(db: Session, property_id: UUID) -> list[GuestDna]:
    return list(
        db.scalars(
            select(GuestDna)
            .where(GuestDna.property_id == property_id, GuestDna.is_at_risk.is_(True))
            .order_by(GuestDna.risk_score.desc())
        )
    )


# --- retention offers -------------------------------------------------------------


def _ensure_offer(db: Session, property_id: UUID, guest_id: UUID, risk, profile_data: dict) -> RetentionOffer | None:
    """One live offer per guest at a time."""
    existing = db.scalars(
        select(RetentionOffer).where(
            RetentionOffer.property_id == property_id,
            RetentionOffer.guest_id == guest_id,
            RetentionOffer.status.in_([OfferStatus.SUGGESTED, OfferStatus.APPROVED, OfferStatus.SENT]),
        )
    ).first()
    if existing is not None:
        return existing

    suggestion = risk.suggested_offer
    offer = RetentionOffer(
        property_id=property_id,
        guest_id=guest_id,
        offer_type=suggestion["type"],
        discount_pct=suggestion["discount_pct"],
        estimated_value=Decimal(str(suggestion["estimated_value"])),
        channel=suggestion["channel"],
        rationale=suggestion["rationale"],
        expires_on=local_today() + timedelta(days=30),
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)

    if risk.risk_score >= OFFER_CARD_MIN_RISK:
        _raise_offer_card(property_id, guest_id, offer, risk, profile_data)
    return offer


def _raise_offer_card(property_id: UUID, guest_id: UUID, offer: RetentionOffer, risk, profile_data: dict) -> None:
    """Put the offer in front of someone who may approve it. Never auto-send."""
    action.post(
        "/cards",
        property_id=property_id,
        json={
            "engine": "guest_intel",
            "kind": "retention_offer",
            "title": f"Win back a {risk.suggested_offer['rationale'].split(',')[0].lower()}",
            "summary": (
                f"This guest has not visited in {risk.days_since_last_visit} days; they "
                f"normally return every {risk.typical_gap_days:.0f}. A "
                f"{offer.discount_pct:.0f}% offer is worth about "
                f"₹{offer.estimated_value:,.0f} against an average spend of "
                f"₹{float(profile_data.get('average_spend') or 0):,.0f}."
            ),
            "required_permission": Perm.OFFERS_APPROVE.value,
            "drivers": [{"label": "Churn signal", "detail": r, "weight": 0.4} for r in risk.reasons[:4]],
            "confidence": risk.risk_score,
            # The impact of winning them back is the visit we would otherwise lose.
            "impact_amount": float(profile_data.get("average_spend") or 0),
            "urgency": "high" if risk.risk_score >= 0.7 else "medium",
            "payload": {
                "offer_id": str(offer.id),
                "guest_id": str(guest_id),
                "discount_pct": offer.discount_pct,
                "editable_fields": ["discount_pct", "impact_amount"],
                "task": {
                    "title": "Send the approved retention offer",
                    "description": f"{offer.discount_pct:.0f}% offer via {offer.channel}.",
                    "department_id": None,
                    "priority": "normal",
                },
            },
            "dedupe_key": f"retention:{guest_id}",
        },
    )


def list_offers(db: Session, property_id: UUID, *, status: str | None = None) -> list[RetentionOffer]:
    query = select(RetentionOffer).where(RetentionOffer.property_id == property_id)
    if status:
        query = query.where(RetentionOffer.status == status)
    return list(db.scalars(query.order_by(RetentionOffer.created_at.desc())))


def approve_offer(db: Session, property_id: UUID, offer_id: UUID, *, actor_id: UUID, message: str | None, discount_pct: float | None) -> RetentionOffer:
    offer = _get_offer(db, property_id, offer_id)
    if offer.status != OfferStatus.SUGGESTED:
        raise Conflict(f"That offer is already {offer.status}")
    if discount_pct is not None:
        if not 0 < discount_pct <= 50:
            raise Invalid("A discount must be between 0 and 50 percent")
        offer.discount_pct = discount_pct
    offer.message = message
    offer.status = OfferStatus.APPROVED
    offer.approved_by = actor_id
    db.commit()
    db.refresh(offer)
    return offer


def send_offer(
    db: Session, property_id: UUID, offer_id: UUID, *, token: str | None = None
) -> RetentionOffer:
    """Hand an approved offer to the outbox, once the guest has actually left.

    After departure, deliberately. A thank-you handed over at the desk turns an ordinary
    checkout into a visible piece of differential treatment — the guest in the next queue
    sees who got something and who did not. Arriving on their phone an hour later it
    reads as a thank-you rather than a grading, which is the whole point of doing this at
    all.

    It also means nobody is rewarded for a stay that has not finished going wrong yet.
    """
    offer = _get_offer(db, property_id, offer_id)
    if offer.status != OfferStatus.APPROVED:
        raise Conflict("Only an approved offer can be sent")

    if _guest_still_in_house(property_id, offer.guest_id, token):
        raise Conflict(
            "This guest has not checked out yet — the offer goes out after they leave"
        )

    guest_row = guest_client.get(
        f"/guests/{offer.guest_id}", property_id=property_id, token=token
    ) or {}
    recipient = guest_row.get("phone")
    if not recipient and offer.channel == "whatsapp":
        raise Invalid(
            "No phone number on file for this guest, so there is nowhere to send it"
        )

    from vesper_common.events import Event, bus

    bus.publish(
        Event.NOTIFY,
        {
            "kind": "retention_offer",
            "channel": offer.channel,
            "guest_id": str(offer.guest_id),
            # The outbox needs somewhere to send it, not just who it is for.
            "recipient": recipient or guest_row.get("email") or f"guest:{offer.guest_id}",
            "subject": "Thank you for staying with us",
            "body": offer.message
            or (
                f"Thank you for staying with us, {guest_row.get('full_name', '').split(' ')[0]}. "
                f"Here is {offer.discount_pct:.0f}% off your next visit."
            ).strip(),
            "offer_id": str(offer.id),
        },
        property_id=str(property_id),
    )
    offer.status = OfferStatus.SENT
    offer.sent_at = utcnow()
    db.commit()
    db.refresh(offer)
    return offer


def _guest_still_in_house(property_id: UUID, guest_id: UUID, token: str | None) -> bool:
    """Is this guest still on the property?

    Fails closed: if front desk cannot be reached we assume they are still here and
    refuse to send. Holding a thank-you back an hour costs nothing; handing one to
    somebody mid-stay is the thing this is designed to avoid.
    """
    stays = frontdesk.get(
        "/stays", property_id=property_id, token=token, params={"status": "in_house"}
    )
    if stays is None:
        log.warning("could not check whether guest %s has left; holding the offer", guest_id)
        return True
    return any(stay.get("guest_id") == str(guest_id) for stay in stays)


def _get_offer(db: Session, property_id: UUID, offer_id: UUID) -> RetentionOffer:
    offer = db.scalars(
        select(RetentionOffer).where(
            RetentionOffer.id == offer_id, RetentionOffer.property_id == property_id
        )
    ).first()
    if offer is None:
        raise NotFound("Offer not found")
    return offer


# --- knowledge base and concierge -------------------------------------------------


def reindex(db: Session, property_id: UUID) -> int:
    passages = db.scalars(
        select(KnowledgePassage).where(
            KnowledgePassage.property_id == property_id, KnowledgePassage.is_active.is_(True)
        )
    ).all()
    index = retriever.for_property(str(property_id))
    index.index(
        [
            retriever.Passage(
                id=str(p.id), title=p.title, content=p.content, category=p.category
            )
            for p in passages
        ]
    )
    return len(passages)


def ask(
    db: Session,
    property_id: UUID,
    question: str,
    *,
    stay_id: UUID | None,
    guest_id: UUID | None,
    user_id: UUID | None,
    asked_by_staff: bool,
) -> ConciergeMessage:
    """Answer a question and keep the transcript."""
    _enforce_rate_limit(db, property_id, stay_id=stay_id, user_id=user_id)

    index = retriever.for_property(str(property_id))
    if index.size == 0:
        reindex(db, property_id)

    hits = index.search(question, top_k=4)
    property_row = property_client.get("/property", property_id=property_id) or {}
    result = concierge.answer(
        question,
        hits,
        property_name=property_row.get("name", "the resort"),
        asked_by_staff=asked_by_staff,
    )

    message = ConciergeMessage(
        property_id=property_id,
        stay_id=stay_id,
        guest_id=guest_id,
        asked_by_user_id=user_id,
        question=question,
        answer=result.text,
        sources=result.sources,
        model=result.model,
        outcome=result.outcome,
        escalated=result.escalate,
        escalation_reason=result.escalation_reason,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def _enforce_rate_limit(db: Session, property_id: UUID, *, stay_id: UUID | None, user_id: UUID | None) -> None:
    """Per asker, per hour.

    Counted in the database rather than in memory: the limit has to hold across
    replicas, and the transcript is already being written anyway.
    """
    since = utcnow() - CONCIERGE_RATE_WINDOW
    query = select(func.count()).select_from(ConciergeMessage).where(
        ConciergeMessage.property_id == property_id, ConciergeMessage.created_at >= since
    )
    if stay_id:
        query = query.where(ConciergeMessage.stay_id == stay_id)
    elif user_id:
        query = query.where(ConciergeMessage.asked_by_user_id == user_id)
    else:
        return

    if (db.scalar(query) or 0) >= CONCIERGE_RATE_LIMIT:
        raise Conflict(
            "You have asked a lot of questions in the past hour — "
            "the front desk can help with anything urgent."
        )


def escalations(db: Session, property_id: UUID, *, unhandled_only: bool = True) -> list[ConciergeMessage]:
    """What the concierge could not answer — a staff queue and a content backlog."""
    query = select(ConciergeMessage).where(
        ConciergeMessage.property_id == property_id, ConciergeMessage.escalated.is_(True)
    )
    if unhandled_only:
        query = query.where(ConciergeMessage.handled_at.is_(None))
    return list(db.scalars(query.order_by(ConciergeMessage.created_at.desc()).limit(100)))


def handle_escalation(db: Session, property_id: UUID, message_id: UUID, *, actor_id: UUID) -> ConciergeMessage:
    message = db.scalars(
        select(ConciergeMessage).where(
            ConciergeMessage.id == message_id, ConciergeMessage.property_id == property_id
        )
    ).first()
    if message is None:
        raise NotFound("Message not found")
    message.handled_by = actor_id
    message.handled_at = utcnow()
    db.commit()
    db.refresh(message)
    return message


def conversation(db: Session, property_id: UUID, stay_id: UUID, *, limit: int = 50) -> list[ConciergeMessage]:
    return list(
        db.scalars(
            select(ConciergeMessage)
            .where(
                ConciergeMessage.property_id == property_id, ConciergeMessage.stay_id == stay_id
            )
            .order_by(ConciergeMessage.created_at)
            .limit(limit)
        )
    )


def list_passages(db: Session, property_id: UUID) -> list[KnowledgePassage]:
    return list(
        db.scalars(
            select(KnowledgePassage)
            .where(KnowledgePassage.property_id == property_id)
            .order_by(KnowledgePassage.category, KnowledgePassage.title)
        )
    )


def create_passage(db: Session, property_id: UUID, data) -> KnowledgePassage:
    passage = KnowledgePassage(property_id=property_id, **data.model_dump())
    db.add(passage)
    db.commit()
    db.refresh(passage)
    reindex(db, property_id)  # a new passage must be answerable immediately
    return passage


def _hour_of(timestamp: str | None) -> int | None:
    if not timestamp:
        return None
    try:
        from vesper_common.clock import to_local

        return to_local(datetime.fromisoformat(timestamp)).hour
    except ValueError:
        return None
