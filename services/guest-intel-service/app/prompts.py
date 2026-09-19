"""Asking the right staff to review a guest before they leave.

A review is worth having only from someone who actually dealt with the guest. Prompting
the whole floor would produce a lot of threes from people who never met them, which is
worse than no data: it drags every score toward the middle and makes the average look
informed when it is not.

So the prompt goes to the people the system already knows were involved — whoever was
assigned a task for that room, or accepted one of that stay's requests — and to nobody
else. A manager can always add their own view.

Timing: the window opens roughly an hour before checkout, which is when the stay is over
in every way that matters and the details are still fresh. Reviews are accepted earlier
too; a housekeeper who formed a view on day two should record it on day two rather than
try to remember it on day four.
"""
from __future__ import annotations

import logging
from datetime import datetime, time, timedelta
from uuid import UUID

from sqlalchemy import select

from vesper_common.clients import guest as guest_client
from vesper_common.clients import frontdesk, identity, property_client, staff
from vesper_common.clock import as_utc, property_tz, utcnow
from vesper_common.db import session_scope

from .models import StaffGuestReview, StayReviewSummary
from .reviews import _summary_row

log = logging.getLogger(__name__)

# How long before checkout to ask. The plan called for about an hour.
PROMPT_HOURS_BEFORE_CHECKOUT = 1.0
# Don't prompt more than this many people for one stay; past a point it is noise.
MAX_REVIEWERS_PER_STAY = 8


def prompt_departing_stays(property_id: str) -> int:
    """Create review tasks for everyone who dealt with a guest leaving shortly.

    Returns how many people were asked.
    """
    now = utcnow()
    checkout_hour = _checkout_hour(property_id)
    stays = frontdesk.get("/stays", property_id=property_id, params={"status": "in_house"}) or []

    asked = 0
    db = session_scope()
    try:
        for stay in stays:
            departs_at = _departure_moment(stay, checkout_hour)
            if departs_at is None:
                continue
            opens_at = departs_at - timedelta(hours=PROMPT_HOURS_BEFORE_CHECKOUT)
            if not (opens_at <= now <= departs_at + timedelta(hours=2)):
                continue

            row = _summary_row(db, UUID(property_id), UUID(stay["id"]), [], None)
            row.departs_on = departs_at.astimezone(property_tz()).date()
            if row.prompted_at is not None:
                continue  # already asked; don't nag every minute

            people = _people_who_dealt_with(property_id, stay)
            reviewed = {
                str(r.reviewed_by)
                for r in db.scalars(
                    select(StaffGuestReview).where(
                        StaffGuestReview.stay_id == UUID(stay["id"])
                    )
                )
            }
            outstanding = [p for p in people if p not in reviewed][:MAX_REVIEWERS_PER_STAY]

            departments = _departments_by_user(property_id)
            for user_id in outstanding:
                if _ask(property_id, stay, user_id, departments.get(user_id)):
                    asked += 1

            row.prompted_at = now
            db.commit()
    finally:
        db.close()

    if asked:
        log.info("asked %s staff member(s) to review a departing guest", asked)
    return asked


def _checkout_hour(property_id: str) -> int:
    row = property_client.get("/property", property_id=property_id) or {}
    return int(row.get("check_out_hour") or 12)


def _departure_moment(stay: dict, checkout_hour: int) -> datetime | None:
    """When this guest is due to leave, as an instant.

    The stay carries a date; the property carries the hour. Combining them in the
    property's own timezone is the only way this lands on the right moment — the bug
    that made every SLA drift by five and a half hours came from skipping exactly this.
    """
    checkout = stay.get("check_out_date") or (stay.get("booking") or {}).get("check_out_date")
    if not checkout:
        return None
    from datetime import date as date_type

    try:
        day = date_type.fromisoformat(checkout)
    except (TypeError, ValueError):
        return None
    local = datetime.combine(day, time(hour=checkout_hour), tzinfo=property_tz())
    return as_utc(local)


def _people_who_dealt_with(property_id: str, stay: dict) -> list[str]:
    """Staff with first-hand contact: assigned a task for the room, or took a request."""
    people: list[str] = []

    tasks = staff.get(
        "/tasks", property_id=property_id, params={"room_id": stay["room_id"], "include_done": True}
    )
    for task in (tasks or {}).get("tasks", []):
        for field in ("assignee_id", "completed_by"):
            person = task.get(field)
            if person and person not in people:
                people.append(person)

    requests = guest_client.get("/requests", property_id=property_id, params={"open_only": False})
    for request in requests or []:
        if request.get("stay_id") != stay["id"]:
            continue
        person = request.get("accepted_by")
        if person and person not in people:
            people.append(person)

    return people


def _departments_by_user(property_id: str) -> dict[str, str]:
    """Which department each person belongs to.

    A task has to belong to a department, and the right one for "review your guest" is
    the reviewer's own — that is what makes the per-department breakdown on the summary
    mean anything.
    """
    users = identity.get("/admin/users", property_id=property_id) or []
    return {
        str(u["id"]): str(u["department_id"]) for u in users if u.get("department_id")
    }


def _ask(property_id: str, stay: dict, user_id: str, department_id: str | None) -> bool:
    """Put the request on that person's task list, where their other work already is."""
    if department_id is None:
        # Someone with no department (an owner, say) has no task list to file this on.
        return False
    created = staff.post(
        "/tasks",
        property_id=property_id,
        json={
            "title": f"Review the guest in room {stay.get('room_number', '?')} before checkout",
            "description": (
                "A short rating and a line on how the stay went from your side. "
                "The guest never sees this; it goes to your manager."
            ),
            "department_id": department_id,
            "assignee_id": user_id,
            "room_id": stay["room_id"],
            "priority": "normal",
            "source": "manual",
            "source_ref": stay["id"],
            "due_in_minutes": 90,
            "meta": {"kind": "guest_review", "stay_id": stay["id"]},
        },
    )
    return created is not None
