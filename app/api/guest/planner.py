"""Fast, property-scoped guest itinerary recommendations.

The catalogue is the source of truth. Crowd levels are estimates from current room
occupancy and typical time-of-day demand, not live facility headcounts.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field


class PlannerRequest(BaseModel):
    plan: str = Field(default="", max_length=600)


class PlannerStop(BaseModel):
    time: str
    amenity: str
    location: str | None
    opening_hours: str | None
    crowd: str
    reason: str
    optional: bool = False


class PlannerResponse(BaseModel):
    day: str
    summary: str
    crowd_note: str
    stops: list[PlannerStop]


_STOP_WORDS = {"a", "an", "and", "at", "for", "i", "in", "my", "of", "on", "the", "to", "want", "with"}
_SLOTS = (9, 11, 13, 15, 17, 19)
_INTENTS = {
    "dining": {"dining", "dinner", "lunch", "breakfast", "brunch", "eat", "food", "restaurant", "cafe", "bar"},
    "wellness": {"spa", "massage", "wellness", "salon", "treatment"},
    "recreation": {"pool", "swim", "swimming", "beach", "sport", "sports", "game", "games", "yoga", "garden"},
}


def _kind(amenity) -> str:
    text = f"{amenity.key} {amenity.name} {amenity.description or ''}".lower()
    if any(word in text for word in ("restaurant", "dining", "cafe", "café", "bar", "bistro", "food")):
        return "dining"
    if any(word in text for word in ("spa", "massage", "wellness", "salon")):
        return "wellness"
    if any(word in text for word in ("pool", "beach", "game", "sport", "yoga", "garden", "recreation")):
        return "recreation"
    return "other"


def _crowd_score(kind: str, hour: int, occupancy: float) -> float:
    peak = {
        "dining": {9: .25, 11: .35, 13: .7, 15: .2, 17: .3, 19: .8},
        "wellness": {9: .15, 11: .4, 13: .6, 15: .5, 17: .7, 19: .25},
        "recreation": {9: .2, 11: .65, 13: .85, 15: .6, 17: .4, 19: .2},
        "other": {9: .2, 11: .4, 13: .5, 15: .5, 17: .4, 19: .2},
    }[kind][hour]
    return min(1.0, occupancy * .45 + peak * .55)


def _matches(plan: str, amenity) -> int:
    tokens = set(re.findall(r"[\w]+", plan.lower())) - _STOP_WORDS
    name = set(re.findall(r"[\w]+", f"{amenity.key} {amenity.name}".lower())) - _STOP_WORDS
    description = set(re.findall(r"[\w]+", (amenity.description or "").lower())) - _STOP_WORDS
    kind = _kind(amenity)
    return 3 * len(tokens & name) + len(tokens & description) + (2 if tokens & _INTENTS.get(kind, set()) else 0)


def make_plan(plan: str, amenities: list, occupancy: float, now: datetime) -> PlannerResponse:
    local_now = now
    available = [a for a in amenities if a.available_now]
    start_hour = local_now.hour + 1
    slots = [hour for hour in _SLOTS if hour >= start_hour]
    if len(slots) < 3:
        local_now += timedelta(days=1)
        slots = list(_SLOTS)

    day = local_now.strftime("%A, %d %B")
    crowd_note = "Crowd levels are estimates from current room occupancy and typical peak times; facility headcounts and reservations are not live. Confirm opening hours and availability before visiting."
    if not available:
        return PlannerResponse(
            day=day,
            summary="No resort experiences are currently listed as available. Ask the concierge for ideas tailored to your stay.",
            crowd_note=crowd_note,
            stops=[],
        )

    requested = plan.strip()
    if re.search(r"\b(no plan|don't have (?:a|any) plan|surprise me)\b", requested.lower()):
        requested = ""
    ranked = sorted(available, key=lambda a: (-_matches(requested, a), a.name))
    matched = [a for a in ranked if requested and _matches(requested, a) > 0]
    selected = matched[:3]
    used_kinds = {_kind(a) for a in selected}
    for amenity in ranked:
        if len(selected) >= min(3, len(slots)):
            break
        if amenity in selected:
            continue
        if _kind(amenity) not in used_kinds or len(available) <= 3:
            selected.append(amenity)
            used_kinds.add(_kind(amenity))
    for amenity in ranked:
        if len(selected) >= min(3, len(slots)):
            break
        if amenity not in selected:
            selected.append(amenity)

    stops: list[PlannerStop] = []
    remaining = slots[:]
    # Place each experience at a suitable, relatively quiet open window.
    preferred = {"dining": (13, 19, 11), "wellness": (11, 15, 17), "recreation": (9, 17, 15), "other": (9, 15, 17)}
    for amenity in selected:
        kind = _kind(amenity)
        requested_hour = None
        if amenity in matched and kind == "dining":
            requested_hour = 19 if "dinner" in requested.lower() else 13 if "lunch" in requested.lower() else 9 if "breakfast" in requested.lower() else None
        hour = min(
            remaining,
            key=lambda h: _crowd_score(kind, h, occupancy)
            + (0 if h in preferred[kind] else .4)
            + (0 if requested_hour is None else abs(h - requested_hour) * .4),
        )
        remaining.remove(hour)
        score = _crowd_score(kind, hour, occupancy)
        crowd = "Quieter" if score < .43 else "Moderate" if score < .68 else "Busier"
        optional = amenity not in matched and kind in {"dining", "wellness"}
        stops.append(PlannerStop(
            time=f"{hour:02d}:00",
            amenity=amenity.name,
            location=amenity.location,
            opening_hours=amenity.opening_hours,
            crowd=crowd,
            reason=("Matches your plan" if amenity in matched else "Optional resort experience" if optional else "A change of pace")
                   + (" · a quieter suggested window" if crowd == "Quieter" else " · consider booking ahead" if crowd == "Busier" else ""),
            optional=optional,
        ))
    stops.sort(key=lambda stop: stop.time)
    summary = (
        "I kept the available parts of your plan and filled the gaps with resort experiences."
        if matched else
        "I couldn't verify those activities in the resort catalogue, so here are available options."
        if requested else
        "A relaxed day with a mix of resort experiences and breathing room between stops."
    )
    return PlannerResponse(day=day, summary=summary, crowd_note=crowd_note, stops=stops)


def property_now(timezone: str) -> datetime:
    try:
        return datetime.now(ZoneInfo(timezone))
    except (KeyError, ValueError):
        return datetime.now(ZoneInfo("Asia/Kolkata"))
