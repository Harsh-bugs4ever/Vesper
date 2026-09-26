from uuid import UUID

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session, session_scope
from vesper_common.events import bus
from vesper_common.permissions import Perm
from vesper_common.security import Principal, authorize_staff_principal, current_user, requires, token_from_query
from vesper_common.errors import Forbidden

from . import service
from .schemas import OutboxCreate, OutboxOut, OutboxSummary

router = APIRouter(prefix="/notifications", tags=["notifications"])
ws_router = APIRouter(tags=["live"])


@ws_router.websocket("/live")
async def live(websocket: WebSocket, token: str = Query(...)) -> None:
    """Authenticated live feed.

    The token comes as a query parameter because a browser cannot set headers on a
    WebSocket handshake. It is a real JWT and is validated the same way — an
    unauthenticated socket is closed before it is accepted, so it never sees an event.
    """
    try:
        principal = token_from_query(token)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Guest QR tokens do not get the operational feed; it carries other rooms' traffic.
    if principal.is_guest:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db = session_scope()
    try:
        principal = authorize_staff_principal(principal, db)
        if principal.role == "service":
            raise ValueError("Service token cannot subscribe")
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    finally:
        db.close()

    await service.hub.connect(
        websocket,
        principal=principal,
    )
    try:
        # Paint the feed immediately rather than waiting for the next event.
        recent = [
            {"type": e.name, "payload": e.payload, "occurred_at": e.occurred_at, "id": e.id}
            for e in bus.recent(25)
            if e.property_id == principal.property_id and principal.can_see_event(e.payload.get("department_id"))
        ]
        await websocket.send_json({"type": "backlog", "events": list(reversed(recent))})

        while True:
            # The client only ever pings; everything else is server-pushed.
            await websocket.receive_text()
            db = session_scope()
            try:
                authorize_staff_principal(principal, db)
            except Exception:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                break
            finally:
                db.close()
            await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        await service.hub.disconnect(websocket, principal.property_id)


@router.get("/outbox", response_model=list[OutboxOut])
def list_outbox(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=200, ge=1, le=1000),
    principal: Principal = Depends(requires(Perm.AUDIT_READ)),
    db: Session = Depends(get_session),
) -> list[OutboxOut]:
    """The outbox page: what was sent, what failed, what we gave up on."""
    rows = service.list_outbox(
        db, UUID(principal.property_id), status=status_filter, limit=limit
    )
    return [OutboxOut.model_validate(r) for r in rows]


@router.get("/outbox/summary", response_model=OutboxSummary)
def outbox_summary(
    principal: Principal = Depends(requires(Perm.AUDIT_READ)),
    db: Session = Depends(get_session),
) -> OutboxSummary:
    return OutboxSummary(**service.outbox_summary(db, UUID(principal.property_id)))


@router.post("/outbox", response_model=OutboxOut, status_code=status.HTTP_201_CREATED)
def queue_message(
    body: OutboxCreate,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> OutboxOut:
    if principal.role not in {"gm", "service"}:
        raise Forbidden("Outbox administration requires General Manager access")
    message = service.queue(
        db,
        UUID(principal.property_id),
        channel=body.channel.value,
        recipient=body.recipient,
        body=body.body,
        kind=body.kind,
        subject=body.subject,
        recipient_user_id=body.recipient_user_id,
        payload=body.payload,
    )
    return OutboxOut.model_validate(service.deliver(db, message))


@router.post("/outbox/{message_id}/retry", response_model=OutboxOut)
def retry(
    message_id: UUID,
    principal: Principal = Depends(requires(Perm.AUDIT_READ)),
    db: Session = Depends(get_session),
) -> OutboxOut:
    """The Retry button. Resets the attempt ceiling on a dead message."""
    return OutboxOut.model_validate(
        service.retry_now(db, UUID(principal.property_id), message_id)
    )


@router.post("/outbox/run-retries", response_model=dict)
def run_retries(
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> dict:
    """Timer-driven sweep of everything due for another attempt."""
    if principal.role != "service":
        raise Forbidden("Service access required")
    return service.run_retries(db, UUID(principal.property_id))


@router.get("/live/connections", response_model=dict)
def connections(principal: Principal = Depends(current_user)) -> dict:
    if principal.role not in {"gm", "service"}:
        raise Forbidden("General Manager access required")
    return {"connected": service.hub.connection_count(principal.property_id)}
