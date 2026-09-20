"""What staff are shown about a guest, and what they are not.

The service note is the half of the review loop that gives something back. It is also
the easiest place to leak a judgement into an operational screen, so what it withholds
matters as much as what it carries.
"""
from __future__ import annotations

from app.api.guest_intel import service_notes

# Anything that would turn guidance into a verdict.
FORBIDDEN_KEYS = {
    "rating", "ratings", "score", "final_score", "mean_rating", "tier",
    "reviewed_by", "reviewer", "reviewer_id", "conflicted", "is_conflicted",
}


def test_the_payload_never_carries_a_rating_or_an_author():
    """A housekeeper who knows the guest was marked a 2 treats them like a 2."""
    payload = service_notes._empty("no guest")
    assert not (set(payload) & FORBIDDEN_KEYS)


def test_an_empty_note_is_explicit_rather_than_silently_blank():
    payload = service_notes._empty("No guest is checked into this stay")
    assert payload["has_anything"] is False
    assert payload["reason"]
    assert payload["notes"] == []
    assert payload["preferences"] == []


def test_the_confidence_floor_is_high_enough_to_be_useful():
    """A guess presented as a fact is worse than silence — someone will act on it."""
    assert service_notes.MIN_NOTE_SENTIMENT >= -0.2


def test_only_a_handful_of_notes_are_carried():
    """This is read on a phone between rooms, not at a desk."""
    assert 1 <= service_notes.MAX_NOTES <= 6
