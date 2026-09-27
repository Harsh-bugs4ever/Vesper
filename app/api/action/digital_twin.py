"""Read-only weather scenarios for the GM. Simulations never mutate operations."""
from __future__ import annotations

import os
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from math import ceil
from uuid import UUID

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.frontdesk.models import Booking, BookingStatus
from app.api.identity.models import User
from app.api.inventory.models import StockItem, StockMovement, MovementReason
from app.api.property.models import Department, Property, Room
from app.api.revenue.models import DemandForecast
from app.api.workforce.engines.roster import STAFFING_MODEL
from app.api.action.weather_learning import archived_weather, learned_multiplier, property_weather_model


@lru_cache(maxsize=64)
def _external(city: str, cache_hour: int, property_lat: float | None = None,
              property_lon: float | None = None, timezone_name: str = "Asia/Kolkata") -> dict:
    """Bounded external lookups; missing feeds are reported, never invented."""
    result = {"weather": [], "social": [], "latitude": None, "longitude": None,
              "weather_status": "unavailable", "social_status": "unavailable",
              "location_source": "unavailable"}
    if property_lat is not None and property_lon is not None:
        lat, lon = property_lat, property_lon
        result["location_source"] = "property_coordinates"
    else:
        try:
            with httpx.Client(timeout=1.5) as client:
                geo = client.get("https://geocoding-api.open-meteo.com/v1/search",
                                 params={"name": city, "count": 1}).json().get("results", [])
            lat, lon = (geo[0]["latitude"], geo[0]["longitude"]) if geo else (None, None)
            if lat is not None:
                result["location_source"] = "city_center"
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            lat = lon = None

    def forecast() -> list[dict]:
        if lat is None or lon is None:
            return []
        with httpx.Client(timeout=1.5) as client:
            weather = client.get("https://api.open-meteo.com/v1/forecast", params={
                "latitude": lat, "longitude": lon, "forecast_days": 15,
                "daily": "precipitation_sum,temperature_2m_max,weather_code",
                "timezone": "auto",
            }).json().get("daily", {})
        return [{"date": day, "rain_mm": float(rain), "max_temp_c": float(temp), "weather_code": code}
                for day, rain, temp, code in zip(weather.get("time", []),
                    weather.get("precipitation_sum", []), weather.get("temperature_2m_max", []),
                    weather.get("weather_code", []))]

    def news() -> tuple[list[dict], str]:
        try:
            with httpx.Client(timeout=1.5) as client:
                rss = client.get("https://news.google.com/rss/search", params={
                    "q": f"{city} rain OR flood OR storm OR travel", "hl": "en-IN",
                    "gl": "IN", "ceid": "IN:en",
                })
                rss.raise_for_status()
            root = ET.fromstring(rss.content)
            articles = [{"title": item.findtext("title") or "", "url": item.findtext("link") or "",
                         "source": item.findtext("source") or "Google News RSS"}
                        for item in root.findall("./channel/item")[:5]
                        if item.findtext("title") and item.findtext("link")]
            return articles, "public_news_rss" if articles else "no_matching_reports"
        except (httpx.HTTPError, ET.ParseError, ValueError):
            return [], "unavailable"

    result["latitude"], result["longitude"] = lat, lon
    with ThreadPoolExecutor(max_workers=3) as pool:
        forecast_job = pool.submit(forecast)
        news_job = pool.submit(news)
        try:
            result["weather"] = forecast_job.result()
            if result["weather"]:
                result["weather_status"] = "live_forecast"
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            pass
        result["social"], result["social_status"] = news_job.result()
    return result


def _nugen_insight(payload: dict) -> dict:
    key = os.getenv("VESPER_NUGEN_API_KEY", "")
    model = os.getenv("VESPER_NUGEN_ALIGNED_MODEL_ID", "")
    if not key or not model:
        return {"status": "not_configured", "model": None, "insight": None}
    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.post("https://api.nugen.in/api/v3/inference/chat/completions",
                headers={"Authorization": f"Bearer {key}"}, json={
                    "model": model, "messages": [
                        {"role": "system", "content": "You are a resort operations analyst. Give one concise, cautious recommendation based only on the supplied figures. State uncertainty. Never claim the simulation is an observed outcome."},
                        {"role": "user", "content": str(payload)[:3000]},
                    ], "max_tokens": 180, "temperature": 0.2, "stream": False,
                })
            response.raise_for_status()
            text = response.json()["choices"][0]["message"]["content"]
            return {"status": "aligned_inference", "model": model, "insight": text}
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
        return {"status": "unavailable", "model": model, "insight": None}


def weather_load_multiplier(department_key: str, rain_mm: float, max_temp_c: float) -> float:
    """Bounded what-if assumption; deliberately separate from trained inference."""
    disruption = min(0.35, max(0, rain_mm - 20) * 0.007 + max(0, max_temp_c - 38) * 0.018)
    return 1 + disruption if department_key in {"fnb", "housekeeping"} else 1 + disruption * 0.5


def build_twin(db: Session, property_id: UUID, department_id: UUID,
               rain_delta_mm: float = 0, heat_delta_c: float = 0) -> dict:
    prop = db.get(Property, property_id)
    department = db.get(Department, department_id)
    if prop is None or department is None or department.property_id != property_id:
        from vesper_common.errors import NotFound
        raise NotFound("Department not found")
    today = date.today()
    end = today + timedelta(days=14)
    forecasts = {row.stay_date: row for row in db.scalars(select(DemandForecast).where(
        DemandForecast.property_id == property_id, DemandForecast.stay_date > today,
        DemandForecast.stay_date <= end)).all()}
    bookings = db.scalars(select(Booking).where(
        Booking.property_id == property_id, Booking.check_in_date <= end,
        Booking.check_out_date > today,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]))).all()
    rooms = db.scalar(select(func.count(Room.id)).where(Room.property_id == property_id)) or 0
    staff = db.scalars(select(User).where(User.property_id == property_id,
        User.department_id == department_id, User.is_active.is_(True)).order_by(User.full_name)).all()
    manager = db.get(User, department.head_user_id) if department.head_user_id else None
    if manager and (manager.property_id != property_id or not manager.is_active):
        manager = None
    stock = db.scalars(select(StockItem).where(StockItem.property_id == property_id,
        StockItem.department_id == department_id, StockItem.is_active.is_(True))).all()
    from time import time
    coordinates = prop.settings or {}
    try:
        property_lat = float(coordinates["latitude"])
        property_lon = float(coordinates["longitude"])
        if not (-90 <= property_lat <= 90 and -180 <= property_lon <= 180):
            property_lat = property_lon = None
    except (KeyError, TypeError, ValueError):
        property_lat = property_lon = None
    external = _external(prop.city, int(time() // 3600), property_lat, property_lon, prop.timezone)
    weather = {row["date"]: row for row in external["weather"]}
    learned = property_weather_model(db, property_id, department_id,
        external["latitude"], external["longitude"], prop.timezone, rooms)
    model = STAFFING_MODEL.get(department.key, {"per_occupied_room": 0, "minimum": 1, "scales": False})
    people = [person for person in staff if manager is None or person.id != manager.id]
    days = []
    for offset in range(1, 15):
        day = today + timedelta(days=offset)
        day_key = day.isoformat()
        booked = sum(booking.check_in_date <= day < booking.check_out_date for booking in bookings)
        forecast = forecasts.get(day)
        baseline = max(booked, round(rooms * forecast.predicted_occupancy)) if forecast else booked
        baseline = min(rooms, baseline)
        lower_rooms = min(rooms, max(booked, round(rooms * forecast.lower_bound))) if forecast else booked
        upper_rooms = min(rooms, max(booked, round(rooms * forecast.upper_bound))) if forecast else booked
        w = weather.get(day_key)
        rain = (w["rain_mm"] if w else 0) + rain_delta_mm
        heat = (w["max_temp_c"] if w else 0) + heat_delta_c
        if learned["status"] == "learned" and w:
            demand_factor = learned_multiplier(learned, baseline, 0, 35, rain, heat,
                                               day.weekday() >= 5)
        else:
            demand_factor = weather_load_multiplier(department.key, rain, heat)
        needed_base = max(model["minimum"], ceil(baseline * model["per_occupied_room"])) if model["scales"] else model["minimum"]
        needed = ceil(needed_base * demand_factor)
        needed_low = ceil((max(model["minimum"], ceil(lower_rooms * model["per_occupied_room"])) if model["scales"] else model["minimum"]) * demand_factor)
        needed_high = ceil((max(model["minimum"], ceil(upper_rooms * model["per_occupied_room"])) if model["scales"] else model["minimum"]) * demand_factor)
        days.append({"date": day_key, "booked_rooms": booked, "forecast_rooms": baseline,
                     "lower_rooms": lower_rooms, "upper_rooms": upper_rooms,
                     "forecast_source": forecast.model_name if forecast else "confirmed_bookings_only",
                     "rain_mm": round(rain, 1) if w else None,
                     "max_temp_c": round(heat, 1) if w else None,
                     "staff_needed": needed, "staff_needed_low": needed_low,
                     "staff_needed_high": needed_high, "staff_available": len(people),
                     "staff_gap": max(0, needed - len(people)),
                     "demand_multiplier": round(demand_factor, 3)})
    peak_rooms = max((row["forecast_rooms"] for row in days), default=0)
    inventory = []
    average_demand_factor = sum(row["demand_multiplier"] for row in days) / len(days)
    since = datetime.now(timezone.utc) - timedelta(days=28)
    consumption = dict(db.execute(select(
        StockMovement.item_id, func.sum(func.abs(StockMovement.quantity)))
        .where(StockMovement.property_id == property_id,
               StockMovement.item_id.in_([item.id for item in stock]),
               StockMovement.reason == MovementReason.CONSUMPTION,
               StockMovement.created_at >= since)
        .group_by(StockMovement.item_id)).all()) if stock else {}
    for item in stock:
        daily_use = float(consumption[item.id]) / 28 if item.id in consumption else None
        projected = max(0.0, 14 * daily_use * average_demand_factor - float(item.quantity)) if daily_use is not None else None
        inventory.append({"name": item.name, "unit": item.unit, "on_hand": float(item.quantity),
                          "minimum": float(item.minimum_quantity), "reorder_quantity": float(item.reorder_quantity),
                          "at_risk": float(item.quantity) <= float(item.minimum_quantity) or (projected is not None and projected > 0),
                          "projected_shortfall": round(projected, 2) if projected is not None else None,
                          "projection_note": "14-day extrapolation from 28 days of consumption, adjusted by scenario demand" if daily_use is not None
                                             else "No recent consumption history; 14-day depletion unknown"})
    summary = {"department": department.name, "peak_forecast_rooms": peak_rooms,
               "peak_staff_gap": max((row["staff_gap"] for row in days), default=0),
               "stock_below_minimum": sum(row["at_risk"] for row in inventory),
               "scenario": {"rain_delta_mm": rain_delta_mm, "heat_delta_c": heat_delta_c}}
    active_weather_model = learned["status"] == "learned" and bool(weather)
    return {"department_id": str(department.id), "department_name": department.name,
            "manager": {"name": manager.full_name, "email": manager.email} if manager else None,
            "staff_count": len(people), "staff": [{"name": p.full_name, "employee_code": p.employee_code} for p in people],
            "days": days, "inventory": inventory, "summary": summary,
            "location": {"city": prop.city, "latitude": external["latitude"],
                         "longitude": external["longitude"], "source": external["location_source"]},
            "weather_status": external["weather_status"], "social_status": external["social_status"],
            "public_reports": external["social"], "model": _nugen_insight(summary),
            "weather_model": {**{key: value for key, value in learned.items() if key != "coefficients"},
                              "used_for_scenario": active_weather_model},
            "method": ("Booking floor plus occupancy forecast; weather response fitted to resort bookings and department work, validated against an occupancy-only baseline."
                       if active_weather_model else
                       "Booking floor plus occupancy forecast; weather response uses bounded assumptions because live weather or validated historical evidence is unavailable.")}
