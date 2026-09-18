"""Time handling.

The Day 1 bug: naive datetimes were stored as IST and compared against UTC, so SLA
timers and attendance windows drifted by 5h30m and night shifts landed on the wrong day.
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vesper_common import clock  # noqa: E402

IST = ZoneInfo("Asia/Kolkata")


def test_utcnow_is_timezone_aware():
    """A naive 'now' is what started the whole class of bug."""
    assert clock.utcnow().tzinfo is not None


def test_a_naive_datetime_is_read_as_property_local():
    """Somebody typing 09:00 means 09:00 in Mumbai, not 09:00 UTC."""
    converted = clock.as_utc(datetime(2026, 9, 17, 9, 0))
    assert converted.tzinfo == timezone.utc
    # 09:00 IST is 03:30 UTC.
    assert converted.hour == 3 and converted.minute == 30


def test_an_aware_datetime_is_converted_not_relabelled():
    aware = datetime(2026, 9, 17, 9, 0, tzinfo=timezone.utc)
    assert clock.as_utc(aware) == aware


def test_the_round_trip_is_lossless():
    original = datetime(2026, 9, 17, 14, 30, tzinfo=IST)
    assert clock.to_local(clock.as_utc(original)) == original


def test_a_local_day_is_a_24_hour_window_offset_from_utc():
    start, end = clock.local_day_bounds(clock.local_today())
    assert end - start == timedelta(days=1)
    assert start.tzinfo == timezone.utc
    # Midnight in Mumbai is 18:30 UTC the previous day.
    assert start.hour == 18 and start.minute == 30


def test_a_late_evening_local_time_still_falls_inside_its_own_day():
    """23:30 IST is 18:00 UTC the same date — the case that used to slip a day."""
    from datetime import date

    day = date(2026, 9, 17)
    start, end = clock.local_day_bounds(day)
    late = clock.as_utc(datetime(2026, 9, 17, 23, 30))
    assert start <= late < end


def test_minutes_between_is_correct_across_representations():
    """An SLA timer must not care which timezone each end was recorded in."""
    raised = datetime(2026, 9, 17, 9, 0, tzinfo=IST)
    delivered = datetime(2026, 9, 17, 4, 5, tzinfo=timezone.utc)  # 09:35 IST
    assert clock.minutes_between(raised, delivered) == 35


def test_minutes_between_handles_a_naive_end():
    raised = datetime(2026, 9, 17, 9, 0, tzinfo=IST)
    delivered = datetime(2026, 9, 17, 9, 40)  # naive, so property-local
    assert clock.minutes_between(raised, delivered) == 40


def test_local_today_matches_the_property_timezone():
    assert clock.local_today() == clock.utcnow().astimezone(IST).date()
