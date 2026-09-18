"""Event names and the Redis-backed bus.

Every cross-service fact travels as an event. One guest order becomes a task, a stock
deduction, a purchase suggestion and a live WebSocket push without guest-service knowing
any of those services exist.

Transport is Redis Streams (durable, replayable, consumer groups) with a pub/sub mirror
so notification-service can fan out to sockets without joining a group.
"""
from __future__ import annotations

import json
import logging
import threading
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from enum import StrEnum
from typing import Any
from uuid import uuid4

import redis

from .clock import utcnow
from .config import settings

log = logging.getLogger(__name__)

STREAM = "vesper:events"
CHANNEL = "vesper:broadcast"
MAXLEN = 50_000


class Event(StrEnum):
    # Staff
    ATTENDANCE_MARKED = "attendance.marked"
    TASK_CREATED = "task.created"
    TASK_ASSIGNED = "task.assigned"
    TASK_COMPLETED = "task.completed"
    ROOM_STATUS_CHANGED = "room.status_changed"

    # Guest
    REQUEST_RAISED = "request.raised"
    REQUEST_ACCEPTED = "request.accepted"
    REQUEST_DELIVERED = "request.delivered"
    REQUEST_OVERDUE = "request.overdue"
    REQUEST_RATED = "request.rated"
    ISSUE_REPORTED = "issue.reported"

    # Inventory
    STOCK_MOVED = "stock.moved"
    STOCK_LOW = "stock.low"
    STOCK_EXPIRING = "stock.expiring"

    # Front desk
    BOOKING_CREATED = "booking.created"
    GUEST_CHECKED_IN = "stay.checked_in"
    GUEST_CHECKED_OUT = "stay.checked_out"

    # Sensors
    SENSOR_READING = "sensor.reading"
    ANOMALY_DETECTED = "asset.anomaly"

    # Decision layer
    CARD_CREATED = "card.created"
    CARD_APPROVED = "card.approved"
    CARD_ADJUSTED = "card.adjusted"
    CARD_SNOOZED = "card.snoozed"
    CARD_DISMISSED = "card.dismissed"
    CARD_EXECUTED = "card.executed"
    CARD_UNDONE = "card.undone"
    OUTCOME_SCORED = "card.outcome_scored"

    # Notification
    NOTIFY = "notify.send"


@dataclass(slots=True)
class Envelope:
    name: str
    payload: dict[str, Any]
    property_id: str | None = None
    actor_id: str | None = None
    source: str = field(default_factory=lambda: settings.service_name)
    id: str = field(default_factory=lambda: str(uuid4()))
    occurred_at: str = field(default_factory=lambda: utcnow().isoformat())

    def to_wire(self) -> dict[str, str]:
        body = asdict(self)
        body["payload"] = json.dumps(self.payload, default=str)
        return {k: ("" if v is None else str(v)) for k, v in body.items()}

    @classmethod
    def from_wire(cls, raw: dict[str, str]) -> Envelope:
        return cls(
            name=raw.get("name", ""),
            payload=json.loads(raw.get("payload") or "{}"),
            property_id=raw.get("property_id") or None,
            actor_id=raw.get("actor_id") or None,
            source=raw.get("source") or "unknown",
            id=raw.get("id") or str(uuid4()),
            occurred_at=raw.get("occurred_at") or utcnow().isoformat(),
        )


class EventBus:
    """Thin wrapper so services never touch redis directly.

    Publishing never raises: a Redis hiccup must not stop a guest ordering dinner. The
    event is logged and dropped, and the HTTP write it accompanied still succeeded.
    """

    def __init__(self, url: str | None = None) -> None:
        self._url = url or settings.redis_url
        self._client: redis.Redis | None = None

    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            self._client = redis.Redis.from_url(self._url, decode_responses=True)
        return self._client

    def publish(
        self,
        name: str | Event,
        payload: dict[str, Any],
        *,
        property_id: str | None = None,
        actor_id: str | None = None,
    ) -> str | None:
        envelope = Envelope(str(name), payload, property_id=property_id, actor_id=actor_id)
        wire = envelope.to_wire()
        try:
            self.client.xadd(STREAM, wire, maxlen=MAXLEN, approximate=True)
            self.client.publish(CHANNEL, json.dumps(wire))
        except redis.RedisError:
            log.warning("event bus unavailable, dropped %s", envelope.name, exc_info=True)
            return None
        return envelope.id

    def subscribe(
        self,
        handler: Callable[[Envelope], None],
        *,
        group: str,
        names: set[str] | None = None,
        block_ms: int = 2000,
    ) -> threading.Thread:
        """Run a consumer-group reader on a daemon thread.

        Each service calls this once at startup with the events it cares about. Handler
        exceptions are logged and the message is still acked — a poison message must not
        wedge the queue during a demo.
        """
        consumer = f"{settings.service_name}-{uuid4().hex[:8]}"

        def run() -> None:
            try:
                self.client.xgroup_create(STREAM, group, id="$", mkstream=True)
            except redis.ResponseError:
                pass  # group already exists
            while True:
                try:
                    batch = self.client.xreadgroup(group, consumer, {STREAM: ">"}, count=32, block=block_ms)
                except redis.RedisError:
                    log.warning("event bus read failed; retrying", exc_info=True)
                    continue
                for _stream, messages in batch or []:
                    for message_id, raw in messages:
                        try:
                            envelope = Envelope.from_wire(raw)
                            if names is None or envelope.name in names:
                                handler(envelope)
                        except Exception:
                            log.exception("handler failed for %s", message_id)
                        finally:
                            self.client.xack(STREAM, group, message_id)

        thread = threading.Thread(target=run, name=f"bus-{group}", daemon=True)
        thread.start()
        return thread

    def recent(self, count: int = 50) -> list[Envelope]:
        """Backing data for the dashboard's live feed on first paint."""
        try:
            entries = self.client.xrevrange(STREAM, count=count)
        except redis.RedisError:
            return []
        return [Envelope.from_wire(raw) for _id, raw in entries]


bus = EventBus()
