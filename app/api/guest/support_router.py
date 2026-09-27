"""API routes for guest support conversations and messaging."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm
from vesper_common.security import Principal, current_guest, current_user, requires

from app.api.guest import service as guest_service, support
from app.api.guest.schemas import (
    DelegateRequest,
    SupportAsk,
    SupportConversationOut,
    SupportMessageWrite,
    SupportPostOut,
    TopicSummaryOut,
)
from app.api.guest_intel.schemas import ConciergeOut
from vesper_common.errors import NotFound
from vesper_common.permissions import Role

guest_router = APIRouter(prefix="/guest/support", tags=["guest-support"])
staff_router = APIRouter(prefix="/support", tags=["staff-support"])


def _guest_view(item: dict, principal: Principal) -> dict:
    if str(item.get("stay_id")) != principal.stay_id:
        raise NotFound("Support conversation not found")
    return {**item, "assigned_owner_id": None,
            "posts": [p for p in item["posts"] if p["visibility"] == "guest"]}


def _staff_view(item: dict, principal: Principal) -> dict:
    department_id = item.get("department_id")
    if principal.role not in {Role.GM, Role.OWNER} and (
        department_id is None or str(department_id) not in principal.department_ids
    ):
        raise NotFound("Support conversation not found")
    return item


@guest_router.post("/ask", response_model=ConciergeOut)
def guest_support_ask(
    body: SupportAsk,
    principal: Principal = Depends(current_guest),
    db: Session = Depends(get_session),
) -> ConciergeOut:
    stay = guest_service.assert_stay_open(
        principal.stay_id,
        principal.property_id,
        room_id=principal.room_id,
        guest_id=principal.guest_id,
    )
    message = support.ask_guest(
        db,
        property_id=UUID(principal.property_id),
        stay_id=UUID(principal.stay_id),
        guest_id=UUID(principal.guest_id) if principal.guest_id else None,
        room_id=UUID(principal.room_id),
        room_number=stay["room_number"],
        question=body.question,
        client_message_id=body.client_message_id,
    )
    return ConciergeOut.model_validate(message)


@guest_router.get("/conversations", response_model=list[SupportConversationOut])
def guest_list_conversations(
    principal: Principal = Depends(current_guest),
    db: Session = Depends(get_session),
) -> list[SupportConversationOut]:
    items = support.list_conversations(
        db,
        UUID(principal.property_id),
        stay_id=UUID(principal.stay_id),
    )
    return [SupportConversationOut(**_guest_view(item, principal)) for item in items]


@guest_router.get("/conversations/{conversation_id}", response_model=SupportConversationOut)
def guest_get_conversation(
    conversation_id: UUID,
    principal: Principal = Depends(current_guest),
    db: Session = Depends(get_session),
) -> SupportConversationOut:
    item = support.get_conversation(db, UUID(principal.property_id), conversation_id)
    return SupportConversationOut(**_guest_view(item, principal))


@guest_router.post("/conversations/{conversation_id}/messages", response_model=SupportPostOut)
def guest_post_message(
    conversation_id: UUID,
    body: SupportMessageWrite,
    principal: Principal = Depends(current_guest),
    db: Session = Depends(get_session),
) -> SupportPostOut:
    _guest_view(support.get_conversation(db, UUID(principal.property_id), conversation_id), principal)
    if body.visibility != "guest":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Guest messages must be guest-visible")
    post = support.add_post(
        db,
        UUID(principal.property_id),
        conversation_id,
        body=body.body,
        author_kind="guest",
        visibility="guest",
        client_message_id=body.client_message_id,
    )
    return SupportPostOut.model_validate(post)


@staff_router.get("/conversations", response_model=list[SupportConversationOut])
def staff_list_conversations(
    department_id: UUID | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> list[SupportConversationOut]:
    items = support.list_conversations(
        db,
        UUID(principal.property_id),
        department_id=department_id,
        status=status_filter,
    )
    return [SupportConversationOut(**item) for item in items
            if principal.role in {Role.GM, Role.OWNER} or
            (item["department_id"] is not None and str(item["department_id"]) in principal.department_ids)]


@staff_router.get("/conversations/{conversation_id}", response_model=SupportConversationOut)
def staff_get_conversation(
    conversation_id: UUID,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> SupportConversationOut:
    item = support.get_conversation(db, UUID(principal.property_id), conversation_id)
    return SupportConversationOut(**_staff_view(item, principal))


@staff_router.post("/conversations/{conversation_id}/messages", response_model=SupportPostOut)
def staff_post_message(
    conversation_id: UUID,
    body: SupportMessageWrite,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> SupportPostOut:
    _staff_view(support.get_conversation(db, UUID(principal.property_id), conversation_id), principal)
    post = support.add_post(
        db,
        UUID(principal.property_id),
        conversation_id,
        body=body.body,
        author_kind="staff",
        author_user_id=UUID(principal.id),
        visibility=body.visibility,
        client_message_id=body.client_message_id,
    )
    return SupportPostOut.model_validate(post)


@staff_router.post("/conversations/{conversation_id}/resolve", response_model=SupportConversationOut)
def staff_resolve_conversation(
    conversation_id: UUID,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> SupportConversationOut:
    _staff_view(support.get_conversation(db, UUID(principal.property_id), conversation_id), principal)
    item = support.resolve_conversation(db, UUID(principal.property_id), conversation_id)
    return SupportConversationOut(**item)


@staff_router.post("/conversations/{conversation_id}/delegate", response_model=SupportConversationOut)
def staff_delegate_conversation(
    conversation_id: UUID,
    body: DelegateRequest,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> SupportConversationOut:
    _staff_view(support.get_conversation(db, UUID(principal.property_id), conversation_id), principal)
    item = support.delegate_conversation(db, UUID(principal.property_id), conversation_id, body.assignee_id)
    return SupportConversationOut(**item)


@staff_router.get("/topics", response_model=list[TopicSummaryOut])
def staff_topic_summaries(
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> list[TopicSummaryOut]:
    items = support.topic_summaries(db, UUID(principal.property_id))
    return [TopicSummaryOut(**item) for item in items
            if principal.role in {Role.GM, Role.OWNER} or
            (item["department_id"] is not None and str(item["department_id"]) in principal.department_ids)]
