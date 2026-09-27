from datetime import datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from app.api.guest.planner import make_plan


def amenity(key: str, name: str, *, available: bool = True):
    return SimpleNamespace(
        key=key,
        name=name,
        description="",
        location="Resort",
        opening_hours="Please confirm",
        available_now=available,
    )


NOW = datetime(2026, 9, 27, 8, tzinfo=ZoneInfo("Asia/Kolkata"))


def test_existing_plan_keeps_requested_experiences_and_excludes_closed_facilities():
    result = make_plan(
        "I'd love the pool and dinner",
        [amenity("pool", "Infinity Pool"), amenity("restaurant", "Garden Restaurant"),
         amenity("spa", "Spa", available=False)],
        .72,
        NOW,
    )

    assert {stop.amenity for stop in result.stops} == {"Infinity Pool", "Garden Restaurant"}
    assert all("Matches your plan" in stop.reason for stop in result.stops)
    assert next(stop for stop in result.stops if stop.amenity == "Garden Restaurant").time == "19:00"
    assert [stop.time for stop in result.stops] == sorted(stop.time for stop in result.stops)
    assert "estimate" in result.crowd_note


def test_no_plan_offers_mix_and_marks_commercial_stop_optional():
    result = make_plan(
        "",
        [amenity("pool", "Infinity Pool"), amenity("spa", "Spa"),
         amenity("restaurant", "Garden Restaurant")],
        .5,
        NOW,
    )

    assert len(result.stops) == 3
    assert any(stop.optional for stop in result.stops)
    assert all(stop.time for stop in result.stops)


def test_empty_catalogue_does_not_invent_experiences():
    result = make_plan("pool and dinner", [], .8, NOW)
    assert result.stops == []
    assert "No resort experiences" in result.summary
