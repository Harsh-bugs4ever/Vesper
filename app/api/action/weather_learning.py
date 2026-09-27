"""Fit a small, auditable weather-to-workload model from resort observations.

The fit is read-only and refreshed against current operational records on each request.
Historical weather is cached for six hours, while task/booking rows are never cached.
"""
from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from math import sqrt
from time import time
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.frontdesk.models import Booking, BookingStatus
from app.api.guest.models import ServiceRequest
from app.api.staff.models import Task, TaskSource


@lru_cache(maxsize=128)
def archived_weather(latitude: float, longitude: float, timezone_name: str,
                     end_day: date, six_hour_bucket: int) -> dict[date, tuple[float, float]]:
    start_day = end_day - timedelta(days=89)
    with httpx.Client(timeout=1.5) as client:
        response = client.get("https://archive-api.open-meteo.com/v1/archive", params={
            "latitude": latitude, "longitude": longitude,
            "start_date": start_day.isoformat(), "end_date": end_day.isoformat(),
            "daily": "precipitation_sum,temperature_2m_max", "timezone": timezone_name,
        })
        response.raise_for_status()
        daily = response.json()["daily"]
    return {date.fromisoformat(day): (float(rain), float(heat))
            for day, rain, heat in zip(daily["time"], daily["precipitation_sum"], daily["temperature_2m_max"])
            if rain is not None and heat is not None}


@lru_cache(maxsize=128)
def _archived_weather_or_empty(latitude: float, longitude: float, timezone_name: str,
                               end_day: date, six_hour_bucket: int) -> dict:
    """Cache feed failures for one refresh bucket so scenarios remain responsive."""
    try:
        return archived_weather(latitude, longitude, timezone_name, end_day, six_hour_bucket)
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return {}


def _features(rooms: int, rain: float, heat: float, weekend: bool) -> list[float]:
    return [1.0, rooms / 100.0, min(rain, 120.0) / 20.0,
            max(0.0, min(heat - 35.0, 15.0)) / 5.0, float(weekend)]


def _solve(matrix: list[list[float]], vector: list[float]) -> list[float]:
    """Gaussian elimination for a tiny ridge system; no optional ML dependency."""
    n = len(vector)
    rows = [matrix[i][:] + [vector[i]] for i in range(n)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda row: abs(rows[row][col]))
        rows[col], rows[pivot] = rows[pivot], rows[col]
        divisor = rows[col][col]
        if abs(divisor) < 1e-9:
            raise ValueError("Weather training matrix is singular")
        for key in range(col, n + 1):
            rows[col][key] /= divisor
        for row in range(n):
            if row == col:
                continue
            factor = rows[row][col]
            for key in range(col, n + 1):
                rows[row][key] -= factor * rows[col][key]
    return [row[-1] for row in rows]


def fit_weather_model(observations: list[tuple[int, float, float, bool, int]]) -> dict:
    """Return a validated model or an explicit insufficient-data result.

    Each row is occupied rooms, rain, max temperature, weekend, and nonduplicate
    department work items. A holdout must beat an occupancy/weekend-only baseline.
    """
    if (len(observations) < 35 or sum(row[4] for row in observations) < 25
            or sum(row[1] >= 10 for row in observations) < 5
            or sum(row[1] < 10 for row in observations) < 10):
        return {"status": "insufficient_history", "samples": len(observations), "mae": None,
                "coefficients": None, "uncertainty": None}

    def fit(rows: list[tuple], weather: bool) -> list[float]:
        size = 5 if weather else 3
        matrix = [[0.0] * size for _ in range(size)]
        vector = [0.0] * size
        for rooms, rain, heat, weekend, count in rows:
            full = _features(rooms, rain, heat, weekend)
            x = full if weather else [full[0], full[1], full[4]]
            for i in range(size):
                vector[i] += x[i] * count
                for j in range(size):
                    matrix[i][j] += x[i] * x[j]
        for i in range(1, size):
            matrix[i][i] += 8.0 if weather and i in (2, 3) else 1.0
        matrix[0][0] += 0.001
        return _solve(matrix, vector)

    training, validation = observations[:-14], observations[-14:]
    weather_coeff = fit(training, True)
    base_coeff = fit(training, False)

    def predict(coeff: list[float], row: tuple, weather: bool) -> float:
        full = _features(row[0], row[1], row[2], row[3])
        x = full if weather else [full[0], full[1], full[4]]
        return max(0.0, sum(a * b for a, b in zip(coeff, x)))

    weather_mae = sum(abs(predict(weather_coeff, row, True) - row[4]) for row in validation) / len(validation)
    base_mae = sum(abs(predict(base_coeff, row, False) - row[4]) for row in validation) / len(validation)
    if weather_mae >= base_mae * 0.95:
        return {"status": "weather_not_predictive", "samples": len(observations),
                "mae": round(weather_mae, 2), "baseline_mae": round(base_mae, 2),
                "coefficients": None, "uncertainty": None}
    coefficients = fit(observations, True)
    residuals = [predict(coefficients, row, True) - row[4] for row in observations]
    rmse = sqrt(sum(value * value for value in residuals) / len(residuals))
    return {"status": "learned", "samples": len(observations),
            "mae": round(weather_mae, 2), "baseline_mae": round(base_mae, 2),
            "coefficients": coefficients, "uncertainty": round(1.64 * rmse, 2)}


def learned_multiplier(model: dict, rooms: int, baseline_rain: float,
                       baseline_heat: float, scenario_rain: float,
                       scenario_heat: float, weekend: bool) -> float:
    coeff = model.get("coefficients")
    if not coeff:
        return 1.0
    def predict(rain: float, heat: float) -> float:
        return max(0.0, sum(a * b for a, b in zip(coeff, _features(rooms, rain, heat, weekend))))
    baseline = predict(baseline_rain, baseline_heat)
    scenario = predict(scenario_rain, scenario_heat)
    return max(0.7, min(1.5, (scenario + 1) / (baseline + 1)))


def property_weather_model(db: Session, property_id: UUID, department_id: UUID,
                           latitude: float | None, longitude: float | None,
                           timezone_name: str, rooms: int) -> dict:
    if latitude is None or longitude is None or rooms <= 0:
        return {"status": "weather_unavailable", "samples": 0, "coefficients": None}
    end = date.today() - timedelta(days=2)
    start = end - timedelta(days=89)
    try:
        weather = _archived_weather_or_empty(latitude, longitude, timezone_name, end, int(time() // 21600))
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return {"status": "weather_unavailable", "samples": 0, "coefficients": None}
    if not weather:
        return {"status": "weather_unavailable", "samples": 0, "coefficients": None}
    bookings = db.scalars(select(Booking).where(
        Booking.property_id == property_id, Booking.check_in_date <= end,
        Booking.check_out_date > start,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN,
                            BookingStatus.CHECKED_OUT]))).all()
    start_time = datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc)
    requests = db.scalars(select(ServiceRequest).where(
        ServiceRequest.property_id == property_id,
        ServiceRequest.department_id == department_id,
        ServiceRequest.created_at >= start_time)).all()
    tasks = db.scalars(select(Task).where(
        Task.property_id == property_id, Task.department_id == department_id,
        Task.created_at >= start_time, Task.source != TaskSource.GUEST_REQUEST)).all()
    zone = ZoneInfo(timezone_name)
    activity = Counter(row.created_at.astimezone(zone).date() for row in [*requests, *tasks])
    occupancy_changes: Counter[date] = Counter()
    for booking in bookings:
        first = max(start, booking.check_in_date)
        last = min(end + timedelta(days=1), booking.check_out_date)
        if first < last:
            occupancy_changes[first] += 1
            occupancy_changes[last] -= 1
    observations = []
    occupied = 0
    for day in sorted(weather):
        rain, heat = weather[day]
        occupied += occupancy_changes[day]
        observations.append((min(rooms, occupied), rain, heat, day.weekday() >= 5, activity[day]))
    return fit_weather_model(observations)
