"""Outbox queueing, the retry loop, and the live WebSocket hub."""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from vesper_common.clock import utcnow
from vesper_common.db import session_scope
from vesper_common.security import Principal, authorize_staff_principal
from vesper_common.errors import Conflict, NotFound

from .models import Channel, OutboxMessage, OutboxStatus

log = logging.getLogger(__name__)

# Give up after this many tries. The row stays as `dead` on the outbox page rather than
# disappearing — an offer that never reached the guest is information.
MAX_ATTEMPTS = 5
# Backoff in minutes per attempt: 1, 5, 15, 60, then dead.
BACKOFF_MINUTES = [1, 5, 15, 60]


def queue(
    db: Session,
    property_id: UUID,
    *,
    channel: str,
    recipient: str,
    body: str,
    kind: str,
    subject: str | None = None,
    recipient_user_id: UUID | None = None,
    payload: dict | None = None,
) -> OutboxMessage:
    message = OutboxMessage(
        property_id=property_id,
        channel=channel,
        recipient=recipient,
        recipient_user_id=recipient_user_id,
        subject=subject,
        body=body,
        kind=kind,
        payload=payload or {},
        next_attempt_at=utcnow(),
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def deliver(db: Session, message: OutboxMessage) -> OutboxMessage:
    """Attempt one send.

    WhatsApp, SMS and email are mocked for the demo — the point of the outbox is the
    retry and audit machinery around the send, not the provider behind it. Swapping in a
    real gateway is one function.
    """
    message.attempts += 1
    try:
        _send(message)
    except Exception as exc:  # noqa: BLE001 - any provider failure is a retry, not a crash
        message.last_error = str(exc)[:500]
        if message.attempts >= MAX_ATTEMPTS:
            message.status = OutboxStatus.DEAD
            message.next_attempt_at = None
            log.error("giving up on outbox message %s after %s attempts", message.id, message.attempts)
        else:
            message.status = OutboxStatus.FAILED
            delay = BACKOFF_MINUTES[min(message.attempts - 1, len(BACKOFF_MINUTES) - 1)]
            message.next_attempt_at = utcnow() + timedelta(minutes=delay)
    else:
        message.status = OutboxStatus.SENT
        message.sent_at = utcnow()
        message.next_attempt_at = None
        message.last_error = None
    db.commit()
    db.refresh(message)
    return message


def _send(message: OutboxMessage) -> None:
    """The mock provider. Raises to simulate a failure path worth retrying."""
    if message.channel == Channel.WEBSOCKET:
        # Live pushes are fan-out, not a provider call; nothing can fail here.
        return
    if not message.recipient:
        raise ValueError("No recipient on the message")
    log.info(
        "[mock %s] to=%s kind=%s body=%s",
        message.channel,
        message.recipient,
        message.kind,
        message.body[:120],
    )


def run_retries(db: Session, property_id: UUID, *, limit: int = 50) -> dict:
    """Called on a timer. Picks up anything due and tries again."""
    now = utcnow()
    due = db.scalars(
        select(OutboxMessage)
        .where(
            OutboxMessage.property_id == property_id,
            OutboxMessage.status.in_([OutboxStatus.PENDING, OutboxStatus.FAILED]),
            OutboxMessage.next_attempt_at.is_not(None),
            OutboxMessage.next_attempt_at <= now,
        )
        .order_by(OutboxMessage.next_attempt_at)
        .limit(limit)
    ).all()

    sent = failed = 0
    for message in due:
        result = deliver(db, message)
        if result.status == OutboxStatus.SENT:
            sent += 1
        else:
            failed += 1
    return {"attempted": len(due), "sent": sent, "failed": failed}


def retry_now(db: Session, property_id: UUID, message_id: UUID) -> OutboxMessage:
    """The Retry button on the outbox page. Works on dead messages too."""
    message = db.scalars(
        select(OutboxMessage).where(
            OutboxMessage.id == message_id, OutboxMessage.property_id == property_id
        )
    ).first()
    if message is None:
        raise NotFound("Message not found")
    if message.status == OutboxStatus.SENT:
        raise Conflict("That message has already been sent")
    # A manual retry resets the ceiling: a human has decided it is worth another go.
    if message.status == OutboxStatus.DEAD:
        message.attempts = 0
    return deliver(db, message)


def list_outbox(
    db: Session, property_id: UUID, *, status: str | None = None, limit: int = 200
) -> list[OutboxMessage]:
    query = select(OutboxMessage).where(OutboxMessage.property_id == property_id)
    if status:
        query = query.where(OutboxMessage.status == status)
    return list(db.scalars(query.order_by(OutboxMessage.created_at.desc()).limit(limit)))


def outbox_summary(db: Session, property_id: UUID) -> dict:
    rows = db.execute(
        select(OutboxMessage.status, func.count(OutboxMessage.id))
        .where(OutboxMessage.property_id == property_id)
        .group_by(OutboxMessage.status)
    ).all()
    counts = {status: count for status, count in rows}
    return {
        "pending": counts.get(OutboxStatus.PENDING, 0),
        "sent": counts.get(OutboxStatus.SENT, 0),
        "failed": counts.get(OutboxStatus.FAILED, 0),
        "dead": counts.get(OutboxStatus.DEAD, 0),
    }


# --- live WebSocket hub -----------------------------------------------------------


class Hub:
    """Tracks open sockets and fans events out to the right people.

    Two filters, both necessary: a socket only ever sees its own property, and a staff
    socket scoped to a department only sees that department's traffic. Sending
    everything to everyone would put guest names on a housekeeper's phone.
    """

    def __init__(self) -> None:
        self._connections: dict[str, list[dict]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket, *, principal: Principal) -> None:
        await websocket.accept()
        property_id = principal.property_id
        async with self._lock:
            self._connections.setdefault(property_id, []).append(
                {
                    "socket": websocket,
                    "user_id": principal.id,
                    "principal": principal,
                }
            )
        log.info("socket connected: property=%s user=%s", property_id, principal.id)

    async def disconnect(self, websocket, property_id: str) -> None:
        async with self._lock:
            sockets = self._connections.get(property_id, [])
            self._connections[property_id] = [c for c in sockets if c["socket"] is not websocket]

    async def broadcast(self, property_id: str, event: dict, *, department_id: str | None = None) -> int:
        """Returns how many sockets received it."""
        async with self._lock:
            targets = list(self._connections.get(property_id, []))

        payload = json.dumps(event, default=str)
        delivered = 0
        dead: list = []
        for connection in targets:
            db = session_scope()
            try:
                principal = authorize_staff_principal(connection["principal"], db)
            except Exception:
                dead.append(connection)
                try:
                    await connection["socket"].close(code=1008)
                except Exception:
                    pass
                continue
            finally:
                db.close()
            if not can_receive(principal, event.get("payload", {})):
                continue
            try:
                await connection["socket"].send_text(payload)
                delivered += 1
            except Exception:
                dead.append(connection)

        if dead:
            async with self._lock:
                sockets = self._connections.get(property_id, [])
                self._connections[property_id] = [c for c in sockets if c not in dead]
        return delivered

    def connection_count(self, property_id: str) -> int:
        return len(self._connections.get(property_id, []))


hub = Hub()


def can_receive(principal: Principal, payload: dict) -> bool:
    participants = payload.get("participant_ids")
    if participants is not None:
        return principal.id in participants and principal.can_see_event(payload.get("department_id"))
    recipients = payload.get("recipient_ids")
    if recipients is not None and principal.id not in recipients:
        return False
    return principal.can_see_event(payload.get("department_id"))
