"""Resort profile, room board, assets, sensor ingest and CSV import."""
from __future__ import annotations

import csv
import io
import secrets
from collections import defaultdict
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from vesper_common.clock import utcnow
from vesper_common.errors import Conflict, Invalid, NotFound
from vesper_common.events import Event, bus

from .models import (
    Asset,
    Department,
    ImportJob,
    Property,
    Room,
    RoomCategory,
    RoomStatus,
    SensorReading,
)

# A room may only move along the housekeeping loop. Anything else is a bug or a typo,
# and silently accepting it is how a board ends up showing a "ready" room with a guest
# still in it.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    RoomStatus.READY: {RoomStatus.OCCUPIED, RoomStatus.DIRTY, RoomStatus.OUT_OF_ORDER},
    RoomStatus.OCCUPIED: {RoomStatus.DIRTY, RoomStatus.OUT_OF_ORDER},
    RoomStatus.DIRTY: {RoomStatus.CLEANING, RoomStatus.OUT_OF_ORDER},
    RoomStatus.CLEANING: {RoomStatus.INSPECTION, RoomStatus.READY, RoomStatus.OUT_OF_ORDER},
    RoomStatus.INSPECTION: {RoomStatus.READY, RoomStatus.CLEANING, RoomStatus.OUT_OF_ORDER},
    RoomStatus.OUT_OF_ORDER: {RoomStatus.DIRTY, RoomStatus.READY},
}


def get_property(db: Session, property_id: UUID) -> Property:
    row = db.get(Property, property_id)
    if row is None:
        raise NotFound("Property not found")
    return row


def update_property(db: Session, property_id: UUID, data) -> Property:
    row = get_property(db, property_id)
    for field in ("name", "address", "city", "check_in_hour", "check_out_hour"):
        value = getattr(data, field)
        if value is not None:
            setattr(row, field, value)
    if data.settings is not None:
        row.settings = {**row.settings, **data.settings}
    db.commit()
    db.refresh(row)
    return row


def set_shadow_mode(db: Session, property_id: UUID, enabled: bool, actor_id: str | None) -> Property:
    """Global preview switch: executors compute and log but never touch the world."""
    row = get_property(db, property_id)
    row.settings = {**row.settings, "shadow_mode": enabled}
    db.commit()
    db.refresh(row)
    bus.publish(
        Event.NOTIFY,
        {"kind": "shadow_mode", "enabled": enabled},
        property_id=str(property_id),
        actor_id=actor_id,
    )
    return row


def list_property_ids(db: Session) -> list[UUID]:
    return list(db.scalars(select(Property.id).order_by(Property.name)))


def list_properties(db: Session) -> list[Property]:
    """Every property, named. Backs the switcher in the admin header."""
    return list(db.scalars(select(Property).order_by(Property.name)))


def list_departments(db: Session, property_id: UUID) -> list[Department]:
    query = select(Department).where(Department.property_id == property_id).order_by(Department.name)
    return list(db.scalars(query))


def list_categories(db: Session, property_id: UUID) -> list[RoomCategory]:
    query = (
        select(RoomCategory)
        .where(RoomCategory.property_id == property_id)
        .order_by(RoomCategory.base_rate)
    )
    return list(db.scalars(query))


def list_rooms(
    db: Session,
    property_id: UUID,
    *,
    status: str | None = None,
    floor: int | None = None,
    category_id: UUID | None = None,
) -> list[Room]:
    query = (
        select(Room)
        .options(joinedload(Room.category))
        .where(Room.property_id == property_id)
        .order_by(Room.floor, Room.number)
    )
    if status:
        query = query.where(Room.status == status)
    if floor is not None:
        query = query.where(Room.floor == floor)
    if category_id:
        query = query.where(Room.category_id == category_id)
    return list(db.scalars(query))


def get_room(db: Session, property_id: UUID, room_id: UUID) -> Room:
    query = (
        select(Room)
        .options(joinedload(Room.category))
        .where(Room.id == room_id, Room.property_id == property_id)
    )
    room = db.scalars(query).first()
    if room is None:
        raise NotFound("Room not found")
    return room


def room_board(db: Session, property_id: UUID) -> dict:
    rooms = list_rooms(db, property_id)
    counts: dict[str, int] = defaultdict(int)
    by_floor: dict[int, list[Room]] = defaultdict(list)
    for room in rooms:
        counts[room.status] += 1
        by_floor[room.floor].append(room)
    return {
        "counts": {status.value: counts.get(status.value, 0) for status in RoomStatus},
        "floors": [{"floor": floor, "rooms": by_floor[floor]} for floor in sorted(by_floor)],
    }


def set_room_status(
    db: Session,
    property_id: UUID,
    room_id: UUID,
    new_status: str,
    *,
    actor_id: str | None = None,
    note: str | None = None,
    force: bool = False,
) -> Room:
    room = get_room(db, property_id, room_id)
    previous = room.status
    if previous == new_status:
        return room
    if not force and new_status not in ALLOWED_TRANSITIONS.get(previous, set()):
        raise Conflict(
            f"Cannot move a room from {previous} to {new_status}",
            details={
                "from": previous,
                "to": new_status,
                "allowed": sorted(ALLOWED_TRANSITIONS[previous]),
            },
        )
    room.status = new_status
    room.status_changed_at = utcnow()
    if note:
        room.notes = note
    if new_status == RoomStatus.DIRTY:
        # A departing guest's QR must stop working the moment they leave.
        room.qr_secret = secrets.token_urlsafe(24)
    db.commit()
    db.refresh(room)

    bus.publish(
        Event.ROOM_STATUS_CHANGED,
        {
            "room_id": str(room.id),
            "room_number": room.number,
            "floor": room.floor,
            "from": previous,
            "to": new_status,
        },
        property_id=str(property_id),
        actor_id=actor_id,
    )
    return room


def list_assets(db: Session, property_id: UUID, *, asset_type: str | None = None) -> list[Asset]:
    query = select(Asset).where(Asset.property_id == property_id).order_by(Asset.name)
    if asset_type:
        query = query.where(Asset.asset_type == asset_type)
    return list(db.scalars(query))


def get_asset(db: Session, property_id: UUID, asset_id: UUID) -> Asset:
    query = select(Asset).where(Asset.id == asset_id, Asset.property_id == property_id)
    asset = db.scalars(query).first()
    if asset is None:
        raise NotFound("Asset not found")
    return asset


def create_asset(db: Session, property_id: UUID, data) -> Asset:
    clash = select(Asset).where(Asset.property_id == property_id, Asset.code == data.code)
    if db.scalars(clash).first():
        raise Conflict("Asset " + data.code + " already exists")
    asset = Asset(property_id=property_id, **data.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def mark_serviced(db: Session, property_id: UUID, asset_id: UUID, serviced_on: date) -> Asset:
    asset = get_asset(db, property_id, asset_id)
    asset.last_serviced_on = serviced_on
    db.commit()
    db.refresh(asset)
    return asset


def record_readings(db: Session, property_id: UUID, readings: list) -> int:
    """BMS connector entry point.

    Maintenance-service listens for the event, not the row: it should never have to know
    which table property-service keeps its telemetry in.
    """
    now = utcnow()
    known = {a.id for a in list_assets(db, property_id)}
    rows = []
    for reading in readings:
        if reading.asset_id not in known:
            raise Invalid("Unknown asset " + str(reading.asset_id))
        rows.append(
            SensorReading(
                asset_id=reading.asset_id,
                metric=reading.metric,
                value=reading.value,
                unit=reading.unit,
                recorded_at=reading.recorded_at or now,
            )
        )
    db.add_all(rows)
    db.commit()
    for reading in readings:
        bus.publish(
            Event.SENSOR_READING,
            {
                "asset_id": str(reading.asset_id),
                "metric": reading.metric,
                "value": reading.value,
                "recorded_at": (reading.recorded_at or now).isoformat(),
            },
            property_id=str(property_id),
        )
    return len(rows)


def asset_readings(
    db: Session, asset_id: UUID, *, metric: str | None = None, hours: int = 72
) -> list[SensorReading]:
    since = utcnow() - timedelta(hours=hours)
    query = (
        select(SensorReading)
        .where(SensorReading.asset_id == asset_id, SensorReading.recorded_at >= since)
        .order_by(SensorReading.recorded_at)
    )
    if metric:
        query = query.where(SensorReading.metric == metric)
    return list(db.scalars(query))


# --- CSV import -------------------------------------------------------------------

IMPORT_SPECS: dict[str, dict] = {
    "rooms": {"required": ["number", "floor", "category_key"], "optional": ["status"]},
    "assets": {
        "required": ["code", "name", "asset_type"],
        "optional": ["location", "criticality", "service_interval_days"],
    },
}


def import_csv(
    db: Session,
    property_id: UUID,
    *,
    entity: str,
    filename: str,
    content: bytes,
    dry_run: bool,
    actor_id: UUID | None,
) -> dict:
    """Validate every row first; commit only when the operator confirms.

    A dry run is the default because a bad column mapping on a 355-room CSV is a very
    slow thing to undo by hand.
    """
    spec = IMPORT_SPECS.get(entity)
    if spec is None:
        raise Invalid("Cannot import " + entity, details={"supported": sorted(IMPORT_SPECS)})

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise Invalid("File must be UTF-8 encoded CSV") from None

    reader = csv.DictReader(io.StringIO(text))
    headers = set(reader.fieldnames or [])
    missing = [c for c in spec["required"] if c not in headers]
    errors: list[dict] = []
    if missing:
        errors.append(
            {"row": 0, "field": ", ".join(missing), "message": "Missing required column(s)"}
        )
        return _import_result(db, property_id, entity, filename, dry_run, 0, 0, errors, actor_id)

    handler = _ROW_HANDLERS[entity]
    rows = list(reader)
    accepted: list = []
    for index, row in enumerate(rows, start=2):  # row 1 is the header
        try:
            accepted.append(handler(db, property_id, row))
        except Invalid as exc:
            errors.append({"row": index, "field": exc.details.get("field"), "message": exc.message})

    if not dry_run and not errors:
        db.add_all(accepted)
        db.commit()

    return _import_result(
        db, property_id, entity, filename, dry_run, len(rows), len(accepted), errors, actor_id
    )


def _import_result(
    db: Session,
    property_id: UUID,
    entity: str,
    filename: str,
    dry_run: bool,
    total: int,
    accepted: int,
    errors: list[dict],
    actor_id: UUID | None,
) -> dict:
    if errors:
        status = "failed"
    elif dry_run:
        status = "previewed"
    else:
        status = "applied"
    job = ImportJob(
        property_id=property_id,
        entity=entity,
        filename=filename,
        dry_run=dry_run,
        status=status,
        total_rows=total,
        accepted_rows=0 if errors else accepted,
        errors=errors,
        created_by=actor_id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {
        "id": job.id,
        "entity": entity,
        "dry_run": dry_run,
        "total_rows": total,
        "accepted_rows": job.accepted_rows,
        "errors": errors,
    }


def _room_row(db: Session, property_id: UUID, row: dict) -> Room:
    number = (row.get("number") or "").strip()
    if not number:
        raise Invalid("Room number is required", details={"field": "number"})
    clash = select(Room).where(Room.property_id == property_id, Room.number == number)
    if db.scalars(clash).first():
        raise Invalid("Room " + number + " already exists", details={"field": "number"})
    try:
        floor = int(row.get("floor") or 0)
    except ValueError:
        raise Invalid("Floor must be a whole number", details={"field": "floor"}) from None
    category_key = (row.get("category_key") or "").strip()
    category = db.scalars(
        select(RoomCategory).where(
            RoomCategory.property_id == property_id, RoomCategory.key == category_key
        )
    ).first()
    if category is None:
        raise Invalid("Unknown room category", details={"field": "category_key"})
    status = (row.get("status") or RoomStatus.READY.value).strip()
    if status not in {s.value for s in RoomStatus}:
        raise Invalid("Unknown room status " + status, details={"field": "status"})
    return Room(
        property_id=property_id,
        category_id=category.id,
        number=number,
        floor=floor,
        status=status,
        qr_secret=secrets.token_urlsafe(24),
    )


def _asset_row(db: Session, property_id: UUID, row: dict) -> Asset:
    code = (row.get("code") or "").strip()
    if not code:
        raise Invalid("Asset code is required", details={"field": "code"})
    clash = select(Asset).where(Asset.property_id == property_id, Asset.code == code)
    if db.scalars(clash).first():
        raise Invalid("Asset " + code + " already exists", details={"field": "code"})
    try:
        interval = int(row.get("service_interval_days") or 180)
    except ValueError:
        raise Invalid(
            "Service interval must be a whole number", details={"field": "service_interval_days"}
        ) from None
    return Asset(
        property_id=property_id,
        code=code,
        name=(row.get("name") or code).strip(),
        asset_type=(row.get("asset_type") or "general").strip(),
        location=(row.get("location") or "").strip() or None,
        criticality=(row.get("criticality") or "medium").strip(),
        service_interval_days=interval,
    )


_ROW_HANDLERS = {"rooms": _room_row, "assets": _asset_row}


def occupancy_snapshot(db: Session, property_id: UUID) -> dict:
    """Used by the dashboard and by revenue-service's forecast features."""
    total = (
        db.scalar(select(func.count()).select_from(Room).where(Room.property_id == property_id)) or 0
    )
    occupied = (
        db.scalar(
            select(func.count())
            .select_from(Room)
            .where(Room.property_id == property_id, Room.status == RoomStatus.OCCUPIED)
        )
        or 0
    )
    return {
        "total_rooms": total,
        "occupied_rooms": occupied,
        "occupancy_rate": round(occupied / total, 4) if total else 0.0,
        "as_of": utcnow().isoformat(),
    }
