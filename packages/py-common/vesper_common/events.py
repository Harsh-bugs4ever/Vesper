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
import time
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

# For cloud Redis (e.g. Redis Cloud), allow sufficient socket timeout for WAN latency
# while keeping local operation fast.
SOCKET_TIMEOUT_SECONDS = 5.0
# After this many consecutive failures, stop trying until the cooldown expires. Retrying
# every publish turns one outage into latency on every single write in the product.
FAILURE_THRESHOLD = 3
COOLDOWN_SECONDS = 15.0
# How long a consumer waits after a failed read before trying again, and the ceiling
# that wait doubles up to. Redis being absent is a normal state on a laptop, and it
# should cost a stopped backend nothing to sit through.
RETRY_DELAY_SECONDS = 2.0
MAX_RETRY_DELAY_SECONDS = 60.0


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
    SUPPORT_ESCALATED = "support.escalated"
    COMMUNICATION_MESSAGE = "communication.message"
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
        self._failures = 0
        self._retry_after = 0.0

    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            self._client = redis.Redis.from_url(
                self._url,
                decode_responses=True,
                socket_timeout=SOCKET_TIMEOUT_SECONDS,
                socket_connect_timeout=SOCKET_TIMEOUT_SECONDS,
            )
        return self._client

    @property
    def available(self) -> bool:
        """False while the breaker is open, so callers skip Redis entirely."""
        return time.monotonic() >= self._retry_after

    def _record_failure(self) -> None:
        self._failures += 1
        if self._failures >= FAILURE_THRESHOLD:
            self._retry_after = time.monotonic() + COOLDOWN_SECONDS
            log.warning(
                "event bus unreachable after %s attempts; pausing for %ss",
                self._failures,
                COOLDOWN_SECONDS,
            )
            self._failures = 0
            # Explicitly close the old client so socket connections are freed on Redis Cloud
            if self._client is not None:
                try:
                    self._client.close()
                except Exception:
                    pass
            self._client = None

    def _record_success(self) -> None:
        self._failures = 0
        self._retry_after = 0.0

    def publish(
        self,
        name: str | Event,
        payload: dict[str, Any],
        *,
        property_id: str | None = None,
        actor_id: str | None = None,
    ) -> str | None:
        envelope = Envelope(str(name), payload, property_id=property_id, actor_id=actor_id)
        if not self.available:
            # The breaker is open. Dropping the event costs a live update; waiting on a
            # dead Redis would cost the guest two seconds on their order.
            log.debug("event bus paused, dropped %s", envelope.name)
            return None

        wire = envelope.to_wire()
        try:
            self.client.xadd(STREAM, wire, maxlen=MAXLEN, approximate=True)
            self.client.publish(CHANNEL, json.dumps(wire))
        except (redis.RedisError, OSError):
            log.warning("event bus unavailable, dropped %s", envelope.name)
            self._record_failure()
            return None
        self._record_success()
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
        consumer = f"{settings.service_name}-{group}-{uuid4().hex[:8]}"

        # The consumer gets its own connection, not the publishing client's. That one is
        # deliberately impatient — half a second, so a guest's order is never held up by
        # a sick Redis — and a blocking XREADGROUP is the opposite: it is *supposed* to
        # sit on the socket for block_ms waiting for the next event. Sharing the client
        # meant every read timed out before it could block, so the consumer spun, logged
        # a stack trace and read again, several times a second, forever. The margin below
        # is what makes the read time out only when Redis has genuinely gone away.
        reader = redis.Redis.from_url(
            self._url,
            decode_responses=True,
            socket_timeout=block_ms / 1000 + SOCKET_TIMEOUT_SECONDS,
            socket_connect_timeout=SOCKET_TIMEOUT_SECONDS,
        )

        def run() -> None:
            # Created inside the loop rather than before it, so a consumer that starts
            # while Redis is still coming up joins the group on its first good pass
            # instead of never joining it at all.
            created = False
            degraded = False
            delay = RETRY_DELAY_SECONDS
            while True:
                try:
                    if not created:
                        try:
                            reader.xgroup_create(STREAM, group, id="$", mkstream=True)
                        except redis.ResponseError:
                            pass  # already exists, which is the normal case
                        created = True
                    batch = reader.xreadgroup(
                        group, consumer, {STREAM: ">"}, count=32, block=block_ms
                    )
                except (redis.RedisError, OSError) as exc:
                    # Say it once, then stop. Twelve consumers retrying a Redis that is
                    # not running turned the log into a wall — which is how you miss the
                    # line that matters. The first failure is a warning, the rest are
                    # debug, and coming back is worth one line.
                    if not degraded:
                        log.warning(
                            "event bus unreachable (%s); %s will retry quietly until it "
                            "is back", exc, group,
                        )
                        degraded = True
                    else:
                        log.debug("event bus still unreachable for %s (%s)", group, exc)
                    created = False
                    # Escalating backoff, so a Redis that is down for an hour costs
                    # almost nothing rather than a reconnect every two seconds.
                    time.sleep(delay)
                    delay = min(delay * 2, MAX_RETRY_DELAY_SECONDS)
                    continue

                if degraded:
                    log.info("event bus reconnected for %s", group)
                    degraded = False
                delay = RETRY_DELAY_SECONDS
                for _stream, messages in batch or []:
                    for message_id, raw in messages:
                        try:
                            envelope = Envelope.from_wire(raw)
                            if names is None or envelope.name in names:
                                handler(envelope)
                        except Exception:
                            log.exception("handler failed for %s", message_id)
                        finally:
                            try:
                                reader.xack(STREAM, group, message_id)
                            except (redis.RedisError, OSError):
                                # Unacked, so it stays pending and is redelivered.
                                log.warning("could not ack %s", message_id)

        thread = threading.Thread(target=run, name=f"bus-{group}", daemon=True)
        thread.start()
        return thread

    def recent(self, count: int = 50) -> list[Envelope]:
        """Backing data for the dashboard's live feed on first paint."""
        if not self.available:
            return []
        try:
            entries = self.client.xrevrange(STREAM, count=count)
        except (redis.RedisError, OSError):
            self._record_failure()
            return []
        return [Envelope.from_wire(raw) for _id, raw in entries]


bus = EventBus()
