"""What the person about to knock on the door should know.

Until now the review flow only took. Staff were asked to rate a guest, the manager read
the result, and the person who wrote it learned nothing. That is exactly how an internal
rating system dies — not through objection, but through people quietly stopping by week
three because it never did anything for them.

This is the other half. Before a housekeeper enters a room or a waiter takes an order,
they can see what colleagues noticed about this guest last time: they take breakfast
early, they are sensitive about noise, they prefer the room done after eleven. That makes
the guest's stay better and makes the two minutes spent writing a review obviously worth
it, which is the only thing that keeps people writing them.

What it deliberately withholds:

  * **Never the ratings.** A number would turn a service note into a verdict, and a
    housekeeper who knows the guest was marked a 2 treats them like a 2.
  * **Never who said it.** The note is useful; the attribution is only useful to a
    manager deciding whether a review was fair, and that lives behind a different
    permission.
  * **Nothing from a conflicted review.** If a guest complained about a department and
    somebody in that department wrote a note about them, it does not get passed to the
    next person as guidance.
"""
from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from vesper_common.clients import frontdesk

from .models import GuestDna, StaffGuestReview

log = logging.getLogger(__name__)

# How many prior notes to carry forward. This is read on a phone between rooms.
MAX_NOTES = 4
# Notes below this sentiment are dropped. A previous colleague's irritation is not
# guidance, and passing it on is how one bad interaction follows a guest for years.
MIN_NOTE_SENTIMENT = -0.15


def notes_for_stay(
    db: Session, property_id: UUID, stay_id: UUID, *, token: str | None = None
) -> dict:
    """Service notes for the guest currently in this stay."""
    stay = frontdesk.get(f"/stays/{stay_id}", property_id=property_id, token=token)
    if stay is None or not stay.get("guest_id"):
        return _empty("No guest is checked into this stay")
    return notes_for_guest(
        db, property_id, UUID(stay["guest_id"]), room_number=stay.get("room_number")
    )


def notes_for_guest(
    db: Session, property_id: UUID, guest_id: UUID, *, room_number: str | None = None
) -> dict:
    """What colleagues have learned about this guest, and what they like.

    Two sources: the preference chips Guest DNA built from what they actually ordered,
    and the useful half of what staff wrote on previous stays.
    """
    dna = db.scalars(
        select(GuestDna).where(
            GuestDna.property_id == property_id, GuestDna.guest_id == guest_id
        )
    ).first()

    preferences: list[str] = []
    if dna:
        # Only the confident chips. A guess presented as a fact is worse than silence,
        # because the person reading it will act on it.
        preferences = [
            f"{p['label']} — {p['detail']}"
            for p in (dna.preferences or [])
            if float(p.get("confidence", 0)) >= 0.6
        ][:4]

    prior = list(
        db.scalars(
            select(StaffGuestReview)
            .where(
                StaffGuestReview.property_id == property_id,
                StaffGuestReview.guest_id == guest_id,
                StaffGuestReview.comment.is_not(None),
                # Nothing written by a department this guest had complained about.
                StaffGuestReview.is_conflicted.is_(False),
                StaffGuestReview.sentiment_score >= MIN_NOTE_SENTIMENT,
            )
            .order_by(StaffGuestReview.created_at.desc())
            .limit(MAX_NOTES)
        )
    )

    return {
        "guest_id": str(guest_id),
        "room_number": room_number,
        # Ratings are deliberately absent. A note guides; a score judges.
        "preferences": preferences,
        "notes": [r.comment for r in prior if r.comment],
        "sensitive_to": list(dna.complaint_themes) if dna else [],
        "is_returning": bool(dna and dna.segment in {"regular", "loyal"}),
        "segment": dna.segment if dna else "unknown",
        "has_anything": bool(preferences or prior or (dna and dna.complaint_themes)),
    }


def _empty(reason: str) -> dict:
    return {
        "guest_id": None,
        "room_number": None,
        "preferences": [],
        "notes": [],
        "sensitive_to": [],
        "is_returning": False,
        "segment": "unknown",
        "has_anything": False,
        "reason": reason,
    }
