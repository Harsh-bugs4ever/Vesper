"""Time helpers.

Prototype bug (Day 1): naive datetimes were stored as IST and compared against UTC, so
SLA timers and attendance windows drifted by 5h30m. Everything here is timezone-aware
UTC on the way in, property-local only on the way out.
"""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from .config import settings

UTC = timezone.utc


def property_tz() -> ZoneInfo:
    return ZoneInfo(settings.property_timezone)


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    """Coerce any datetime to aware UTC, assuming property-local if naive."""
    if value.tzinfo is None:
        return value.replace(tzinfo=property_tz()).astimezone(UTC)
    return value.astimezone(UTC)


def to_local(value: datetime) -> datetime:
    return as_utc(value).astimezone(property_tz())


def local_today() -> date:
    return utcnow().astimezone(property_tz()).date()


def local_day_bounds(day: date) -> tuple[datetime, datetime]:
    """UTC half-open range [start, end) covering one property-local calendar day."""
    tz = property_tz()
    start = datetime.combine(day, time.min, tzinfo=tz)
    return start.astimezone(UTC), (start + timedelta(days=1)).astimezone(UTC)


def minutes_between(start: datetime, end: datetime) -> float:
    return (as_utc(end) - as_utc(start)).total_seconds() / 60.0
