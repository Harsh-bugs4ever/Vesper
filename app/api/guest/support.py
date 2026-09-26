"""Guest support routing, concierge message persistence, and escalation workflows."""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from vesper_common.clock import utcnow
from vesper_common.errors import NotFound
from vesper_common.events import Event, bus

from app.api.guest.models import SupportConversation, SupportParticipant, SupportPost
from app.api.guest_intel import service as intel_service
from app.api.guest_intel.models import ConciergeMessage


def ask_guest(
    db: Session,
    property_id: UUID,
    stay_id: UUID,
    guest_id: UUID | None,
    room_id: UUID,
    room_number: str,
    question: str,
    client_message_id: UUID | None = None,
) -> ConciergeMessage:
    """Route a guest question through knowledge/concierge, creating support threads when needed."""
    # Find or create conversation for this stay
    conv = db.scalars(
        select(SupportConversation)
        .where(
            SupportConversation.property_id == property_id,
            SupportConversation.stay_id == stay_id,
            SupportConversation.status != "resolved",
        )
        .order_by(SupportConversation.created_at.desc())
    ).first()

    if conv is None:
        conv = SupportConversation(
            id=uuid4(),
            property_id=property_id,
            kind="guest_support",
            stay_id=stay_id,
            guest_id=guest_id,
            room_id=room_id,
            room_number=room_number,
            topic=question[:40].strip() or "Guest Inquiry",
            urgency="normal",
            status="open",
        )
        db.add(conv)
        db.flush()

    # Generate answer via concierge
    msg = intel_service.ask(
        db,
        property_id,
        question,
        stay_id=stay_id,
        guest_id=guest_id,
        user_id=None,
        asked_by_staff=False,
        conversation_id=conv.id,
    )

    # Record guest post (idempotently if client_message_id provided)
    if client_message_id is not None:
        existing_post = db.scalars(
            select(SupportPost).where(
                SupportPost.property_id == property_id,
                SupportPost.client_message_id == client_message_id,
            )
        ).first()
    else:
        existing_post = None

    if existing_post is None:
        guest_post = SupportPost(
            id=uuid4(),
            property_id=property_id,
            conversation_id=conv.id,
            client_message_id=client_message_id,
            author_kind="guest",
            visibility="guest",
            body=question,
        )
        db.add(guest_post)

    # Record AI answer post
    ai_post = SupportPost(
        id=uuid4(),
        property_id=property_id,
        conversation_id=conv.id,
        author_kind="ai",
        visibility="guest",
        body=msg.answer,
    )
    db.add(ai_post)

    if msg.escalated:
        conv.status = "escalated"
        conv.escalation_reason = msg.escalation_reason
        conv.urgency = "high"
        bus.publish(
            Event.SUPPORT_ESCALATED,
            {
                "conversation_id": str(conv.id),
                "property_id": str(property_id),
                "room_number": room_number,
                "reason": msg.escalation_reason,
            },
            property_id=str(property_id),
        )

    db.commit()
    db.refresh(msg)
    return msg


def list_conversations(
    db: Session,
    property_id: UUID,
    *,
    stay_id: UUID | None = None,
    department_id: UUID | None = None,
    status: str | None = None,
) -> list[dict]:
    query = select(SupportConversation).where(SupportConversation.property_id == property_id)
    if stay_id:
        query = query.where(SupportConversation.stay_id == stay_id)
    if department_id:
        query = query.where(SupportConversation.department_id == department_id)
    if status:
        query = query.where(SupportConversation.status == status)

    convs = db.scalars(query.order_by(SupportConversation.created_at.desc())).all()
    results = []
    for c in convs:
        posts = db.scalars(
            select(SupportPost)
            .where(SupportPost.conversation_id == c.id)
            .order_by(SupportPost.created_at.asc())
        ).all()
        results.append({
            "id": c.id,
            "kind": c.kind,
            "topic": c.topic,
            "urgency": c.urgency,
            "status": c.status,
            "department_id": c.department_id,
            "escalation_reason": c.escalation_reason,
            "assigned_owner_id": c.assigned_owner_id,
            "request_id": c.request_id,
            "acknowledged_at": c.acknowledged_at,
            "resolved_at": c.resolved_at,
            "created_at": c.created_at,
            "posts": [
                {
                    "id": p.id,
                    "author_kind": p.author_kind,
                    "visibility": p.visibility,
                    "body": p.body,
                    "created_at": p.created_at,
                }
                for p in posts
            ],
            "unread_count": 0,
        })
    return results


def get_conversation(db: Session, property_id: UUID, conversation_id: UUID) -> dict:
    c = db.scalars(
        select(SupportConversation).where(
            SupportConversation.property_id == property_id,
            SupportConversation.id == conversation_id,
        )
    ).first()
    if c is None:
        raise NotFound("Support conversation not found")

    posts = db.scalars(
        select(SupportPost)
        .where(SupportPost.conversation_id == c.id)
        .order_by(SupportPost.created_at.asc())
    ).all()
    return {
        "id": c.id,
        "kind": c.kind,
        "topic": c.topic,
        "urgency": c.urgency,
        "status": c.status,
        "department_id": c.department_id,
        "escalation_reason": c.escalation_reason,
        "assigned_owner_id": c.assigned_owner_id,
        "request_id": c.request_id,
        "acknowledged_at": c.acknowledged_at,
        "resolved_at": c.resolved_at,
        "created_at": c.created_at,
        "posts": [
            {
                "id": p.id,
                "author_kind": p.author_kind,
                "visibility": p.visibility,
                "body": p.body,
                "created_at": p.created_at,
            }
            for p in posts
        ],
        "unread_count": 0,
    }


def add_post(
    db: Session,
    property_id: UUID,
    conversation_id: UUID,
    *,
    body: str,
    author_kind: str,
    author_user_id: UUID | None = None,
    visibility: str = "guest",
    client_message_id: UUID | None = None,
) -> SupportPost:
    c = db.scalars(
        select(SupportConversation).where(
            SupportConversation.property_id == property_id,
            SupportConversation.id == conversation_id,
        )
    ).first()
    if c is None:
        raise NotFound("Conversation not found")

    post = SupportPost(
        id=uuid4(),
        property_id=property_id,
        conversation_id=c.id,
        client_message_id=client_message_id,
        author_kind=author_kind,
        author_user_id=author_user_id,
        visibility=visibility,
        body=body,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def resolve_conversation(db: Session, property_id: UUID, conversation_id: UUID) -> dict:
    c = db.scalars(
        select(SupportConversation).where(
            SupportConversation.property_id == property_id,
            SupportConversation.id == conversation_id,
        )
    ).first()
    if c is None:
        raise NotFound("Conversation not found")
    c.status = "resolved"
    c.resolved_at = utcnow()
    db.commit()
    return get_conversation(db, property_id, conversation_id)


def delegate_conversation(db: Session, property_id: UUID, conversation_id: UUID, assignee_id: UUID) -> dict:
    c = db.scalars(
        select(SupportConversation).where(
            SupportConversation.property_id == property_id,
            SupportConversation.id == conversation_id,
        )
    ).first()
    if c is None:
        raise NotFound("Conversation not found")
    c.assigned_owner_id = assignee_id
    c.status = "assigned"
    db.commit()
    return get_conversation(db, property_id, conversation_id)


def topic_summaries(db: Session, property_id: UUID) -> list[dict]:
    stmt = select(
        SupportConversation.department_id,
        SupportConversation.topic,
        SupportConversation.urgency,
        func.count(SupportConversation.id).label("total"),
        func.coalesce(func.sum(func.case((SupportConversation.status != "resolved", 1), else_=0)), 0).label("unresolved"),
    ).where(
        SupportConversation.property_id == property_id
    ).group_by(
        SupportConversation.department_id,
        SupportConversation.topic,
        SupportConversation.urgency,
    )
    rows = db.execute(stmt).all()
    return [
        {
            "department_id": r.department_id,
            "topic": r.topic,
            "urgency": r.urgency,
            "total": int(r.total),
            "unresolved": int(r.unresolved),
            "oldest_unresolved_hours": None,
        }
        for r in rows
    ]
