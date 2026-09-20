"""Staff turns events from elsewhere into work on somebody's phone.

A guest request, a reported issue and an approved action card all become the same thing
here: a task with a department, a priority and a clock running against it.
"""
import logging
from types import SimpleNamespace
from uuid import UUID

from vesper_common.app_factory import on_events
from vesper_common.db import session_scope
from vesper_common.errors import VesperError
from vesper_common.events import Envelope, Event

from . import service
from .models import TaskPriority, TaskSource

log = logging.getLogger(__name__)

WATCHED = {
    Event.REQUEST_RAISED.value,
    Event.ISSUE_REPORTED.value,
    Event.CARD_EXECUTED.value,
}

# Guest-facing request kinds map onto the departments that actually do the work.
# guest-service sends department_id when it knows it; this is the fallback label.
REQUEST_TITLES = {
    "room_service": "Room service order",
    "housekeeping": "Cleaning request",
    "amenities": "Amenity request",
    "maintenance": "In-room issue",
    "other": "Guest request",
}


@on_events("staff-service", WATCHED)
def handle(envelope: Envelope) -> None:
    db = session_scope()
    try:
        if envelope.name == Event.REQUEST_RAISED.value:
            _task_from_request(db, envelope)
        elif envelope.name == Event.ISSUE_REPORTED.value:
            _task_from_issue(db, envelope)
        elif envelope.name == Event.CARD_EXECUTED.value:
            _task_from_card(db, envelope)
    except VesperError as exc:
        log.warning("could not turn %s into a task: %s", envelope.name, exc)
    except Exception:
        log.exception("unexpected failure handling %s", envelope.name)
    finally:
        db.close()


def _draft(**kwargs) -> SimpleNamespace:
    """service.create_task takes the same shape whether it came from HTTP or the bus."""
    base = {
        "title": "",
        "description": None,
        "department_id": None,
        "assignee_id": None,
        "room_id": None,
        "priority": TaskPriority.NORMAL,
        "source": TaskSource.MANUAL,
        "source_ref": None,
        "due_in_minutes": None,
        "meta": {},
    }
    return SimpleNamespace(**(base | kwargs))


def _task_from_request(db, envelope: Envelope) -> None:
    payload = envelope.payload
    department_id = payload.get("department_id")
    if not department_id:
        log.warning("request %s has no department; skipping", payload.get("request_id"))
        return

    kind = payload.get("kind", "other")
    room_number = payload.get("room_number")
    title = REQUEST_TITLES.get(kind, REQUEST_TITLES["other"])
    if room_number:
        title = f"{title} — Room {room_number}"

    service.create_task(
        db,
        UUID(envelope.property_id),
        _draft(
            title=title,
            description=payload.get("note"),
            department_id=UUID(department_id),
            room_id=UUID(payload["room_id"]) if payload.get("room_id") else None,
            priority=payload.get("priority", TaskPriority.HIGH),
            source=TaskSource.GUEST_REQUEST,
            source_ref=UUID(payload["request_id"]) if payload.get("request_id") else None,
            meta={"items": payload.get("items", []), "kind": kind},
        ),
        actor_id=envelope.actor_id,
        # The SLA the department promised is the deadline; don't invent a second one.
        sla_minutes=payload.get("sla_minutes"),
    )


def _task_from_issue(db, envelope: Envelope) -> None:
    payload = envelope.payload
    if not payload.get("department_id"):
        return
    location = payload.get("room_number") or payload.get("location") or "property"
    service.create_task(
        db,
        UUID(envelope.property_id),
        _draft(
            title=f"Fix: {payload.get('summary', 'reported issue')} — {location}",
            description=payload.get("description"),
            department_id=UUID(payload["department_id"]),
            room_id=UUID(payload["room_id"]) if payload.get("room_id") else None,
            priority=payload.get("priority", TaskPriority.NORMAL),
            source=TaskSource.ISSUE,
            source_ref=UUID(payload["issue_id"]) if payload.get("issue_id") else None,
            meta={"photo_url": payload.get("photo_url")},
        ),
        actor_id=envelope.actor_id,
    )


def _task_from_card(db, envelope: Envelope) -> None:
    """Approved cards that need hands, not just a database write.

    A work order or a roster change becomes a task; a rate change does not — that one
    executes itself.
    """
    payload = envelope.payload
    task_spec = payload.get("task")
    if not task_spec or not task_spec.get("department_id"):
        return
    service.create_task(
        db,
        UUID(envelope.property_id),
        _draft(
            title=task_spec.get("title", "Approved action"),
            description=task_spec.get("description"),
            department_id=UUID(task_spec["department_id"]),
            priority=task_spec.get("priority", TaskPriority.HIGH),
            source=TaskSource.ACTION_CARD,
            source_ref=UUID(payload["card_id"]) if payload.get("card_id") else None,
            due_in_minutes=task_spec.get("due_in_minutes"),
            meta={"card_kind": payload.get("kind")},
        ),
        actor_id=envelope.actor_id,
    )


start_subscriptions = handle
