from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm, Role
from fastapi import HTTPException
from vesper_common.security import Principal, current_user, requires

from . import service
from .schemas import (
    AssetCreate,
    AssetOut,
    AssetServiced,
    DepartmentOut,
    ImportResult,
    PropertyOut,
    PropertySummary,
    PropertyUpdate,
    RoomBoardOut,
    RoomCategoryOut,
    RoomDetail,
    RoomOut,
    RoomStatusUpdate,
    SensorReadingIn,
    SensorReadingOut,
    ShadowModeUpdate,
)

router = APIRouter(prefix="/property", tags=["property"])


def _room_access(principal: Principal = Depends(current_user), db: Session = Depends(get_session)) -> None:
    if principal.role in {Role.GM, "service"}:
        return
    from .models import Department
    from sqlalchemy import select
    ids = db.scalars(select(Department.id).where(Department.property_id == UUID(principal.property_id), Department.key.in_(["housekeeping", "front_office"]))).all()
    if not any(str(department_id) in principal.department_ids for department_id in ids):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Room operations are outside your departments")


rooms_router = APIRouter(prefix="/rooms", tags=["rooms"], dependencies=[Depends(_room_access)])
assets_router = APIRouter(prefix="/assets", tags=["assets"])


def _room_detail(room) -> RoomDetail:
    return RoomDetail(
        **RoomOut.model_validate(room).model_dump(),
        category_key=room.category.key,
        category_name=room.category.name,
    )


@router.get("", response_model=PropertyOut)
def get_property(
    principal: Principal = Depends(current_user), db: Session = Depends(get_session)
) -> PropertyOut:
    principal.require(Perm.PROPERTY_READ)
    return PropertyOut.model_validate(service.get_property(db, UUID(principal.property_id)))


@router.patch("", response_model=PropertyOut)
def update_property(
    body: PropertyUpdate,
    principal: Principal = Depends(requires(Perm.PROPERTY_WRITE)),
    db: Session = Depends(get_session),
) -> PropertyOut:
    return PropertyOut.model_validate(
        service.update_property(db, UUID(principal.property_id), body)
    )


@router.put("/shadow-mode", response_model=PropertyOut)
def set_shadow_mode(
    body: ShadowModeUpdate,
    principal: Principal = Depends(requires(Perm.SHADOW_TOGGLE)),
    db: Session = Depends(get_session),
) -> PropertyOut:
    row = service.set_shadow_mode(db, UUID(principal.property_id), body.enabled, principal.id)
    return PropertyOut.model_validate(row)


@router.get("/ids", response_model=list[str])
def property_ids(principal: Principal = Depends(current_user), db: Session = Depends(get_session)) -> list[str]:
    """Every property id this deployment serves.

    Used by scheduled jobs, which have to cover all properties and have no property to
    scope a token to until they have this list. It returns ids and nothing else, so it
    carries no information worth protecting.
    """
    if principal.role != "service":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Service access required")
    return [str(pid) for pid in service.list_property_ids(db)]


@router.get("/list", response_model=list[PropertySummary])
def list_properties(
    principal: Principal = Depends(current_user), db: Session = Depends(get_session)
) -> list[PropertySummary]:
    """Assigned properties, named, for the branch switcher.

    This list is scoped to current branch assignments.
    """
    return [PropertySummary.model_validate(p) for p in service.list_properties(db) if str(p.id) in principal.property_ids]


@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(
    principal: Principal = Depends(current_user), db: Session = Depends(get_session)
) -> list[DepartmentOut]:
    rows = service.list_departments(db, UUID(principal.property_id))
    return [DepartmentOut.model_validate(r) for r in rows if principal.role == Role.GM or str(r.id) in principal.department_ids]


@router.get("/public", response_model=PropertySummary)
def get_public_property(
    property_id: UUID | None = None,
    db: Session = Depends(get_session),
) -> PropertySummary:
    """Guest-safe and public-safe property information for landing and orientation."""
    p_id = property_id
    if not p_id:
        ids = service.list_property_ids(db)
        if ids:
            p_id = UUID(ids[0])
    if not p_id:
        from vesper_common.errors import NotFound
        raise NotFound("Property not found")
    prop = service.get_property(db, p_id)
    return PropertySummary.model_validate(prop)


@router.get("/public/room-categories", response_model=list[RoomCategoryOut])
def list_public_categories(
    property_id: UUID | None = None,
    db: Session = Depends(get_session),
) -> list[RoomCategoryOut]:
    """Public room categories catalogue for guests and prospective arrivals."""
    p_id = property_id
    if not p_id:
        ids = service.list_property_ids(db)
        if ids:
            p_id = UUID(ids[0])
    if not p_id:
        return []
    rows = service.list_categories(db, p_id)
    return [RoomCategoryOut.model_validate(r) for r in rows]


@router.get("/room-categories", response_model=list[RoomCategoryOut])
def list_categories(
    principal: Principal = Depends(current_user), db: Session = Depends(get_session)
) -> list[RoomCategoryOut]:
    principal.require_department_key(db, "front_office")
    rows = service.list_categories(db, UUID(principal.property_id))
    return [RoomCategoryOut.model_validate(r) for r in rows]


@router.get("/occupancy", response_model=dict)
def occupancy(
    principal: Principal = Depends(current_user), db: Session = Depends(get_session)
) -> dict:
    principal.require_department_key(db, "front_office")
    return service.occupancy_snapshot(db, UUID(principal.property_id))


@router.post("/import", response_model=ImportResult)
async def import_csv(
    entity: str = Form(...),
    dry_run: bool = Form(True),
    file: UploadFile = File(...),
    principal: Principal = Depends(requires(Perm.IMPORT_RUN)),
    db: Session = Depends(get_session),
) -> ImportResult:
    """Upload a CSV. Defaults to a dry run so the operator sees the damage first."""
    content = await file.read()
    result = service.import_csv(
        db,
        UUID(principal.property_id),
        entity=entity,
        filename=file.filename or "upload.csv",
        content=content,
        dry_run=dry_run,
        actor_id=UUID(principal.id),
    )
    return ImportResult(**result)


@rooms_router.get("", response_model=list[RoomDetail])
def list_rooms(
    status_filter: str | None = Query(default=None, alias="status"),
    floor: int | None = None,
    category_id: UUID | None = None,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> list[RoomDetail]:
    rooms = service.list_rooms(
        db, UUID(principal.property_id), status=status_filter, floor=floor, category_id=category_id
    )
    return [_room_detail(r) for r in rooms]


@rooms_router.get("/board", response_model=RoomBoardOut)
def room_board(
    principal: Principal = Depends(current_user), db: Session = Depends(get_session)
) -> RoomBoardOut:
    """The housekeeping board: counts on top, rooms grouped by floor underneath."""
    board = service.room_board(db, UUID(principal.property_id))
    return RoomBoardOut(
        counts=board["counts"],
        floors=[
            {"floor": f["floor"], "rooms": [_room_detail(r) for r in f["rooms"]]}
            for f in board["floors"]
        ],
    )


@rooms_router.get("/{room_id}/qr", response_model=dict)
def room_qr(
    room_id: UUID,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> dict:
    """The room's current QR secret, for guest-service to check a scan against.

    Deliberately not on the public room payload: the secret is what makes a nightstand
    QR unforgeable, so it goes to callers that already hold a property-scoped token and
    nowhere near a browser.
    """
    if principal.role != "service":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Service access required")
    room = service.get_room(db, UUID(principal.property_id), room_id)
    return {"id": str(room.id), "number": room.number, "qr_secret": room.qr_secret}


@rooms_router.get("/{room_id}", response_model=RoomDetail)
def get_room(
    room_id: UUID,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> RoomDetail:
    return _room_detail(service.get_room(db, UUID(principal.property_id), room_id))


@rooms_router.put("/{room_id}/status", response_model=RoomDetail)
def set_room_status(
    room_id: UUID,
    body: RoomStatusUpdate,
    principal: Principal = Depends(requires(Perm.ROOMS_STATUS_WRITE)),
    db: Session = Depends(get_session),
) -> RoomDetail:
    principal.require_department_key(db, "housekeeping")
    room = service.set_room_status(
        db,
        UUID(principal.property_id),
        room_id,
        body.status.value,
        actor_id=principal.id,
        note=body.note,
    )
    return _room_detail(room)


@assets_router.get("", response_model=list[AssetOut])
def list_assets(
    asset_type: str | None = None,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> list[AssetOut]:
    principal.require(Perm.PROPERTY_READ)
    rows = service.list_assets(db, UUID(principal.property_id), asset_type=asset_type)
    return [AssetOut.model_validate(r) for r in rows if principal.role in {Role.GM, "service"} or principal.can_see_department(r.department_id)]


@assets_router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(
    body: AssetCreate,
    principal: Principal = Depends(requires(Perm.PROPERTY_WRITE)),
    db: Session = Depends(get_session),
) -> AssetOut:
    principal.require_department_record(db, body.department_id)
    return AssetOut.model_validate(service.create_asset(db, UUID(principal.property_id), body))


@assets_router.get("/{asset_id}", response_model=AssetOut)
def get_asset(
    asset_id: UUID,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> AssetOut:
    principal.require(Perm.PROPERTY_READ)
    asset = service.get_asset(db, UUID(principal.property_id), asset_id)
    principal.require_object(asset)
    return AssetOut.model_validate(asset)


@assets_router.post("/{asset_id}/serviced", response_model=AssetOut)
def mark_serviced(
    body: AssetServiced,
    asset_id: UUID,
    principal: Principal = Depends(requires(Perm.PROPERTY_WRITE)),
    db: Session = Depends(get_session),
) -> AssetOut:
    """Reset the service clock.

    maintenance-service calls this when a work order completes, so the asset stops
    scoring as overdue on the next risk sweep.
    """
    principal.require_object(service.get_asset(db, UUID(principal.property_id), asset_id))
    asset = service.mark_serviced(db, UUID(principal.property_id), asset_id, body.serviced_on)
    return AssetOut.model_validate(asset)


@assets_router.get("/{asset_id}/readings", response_model=list[SensorReadingOut])
def asset_readings(
    asset_id: UUID,
    metric: str | None = None,
    hours: int = Query(default=72, ge=1, le=24 * 30),
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> list[SensorReadingOut]:
    principal.require(Perm.PROPERTY_READ)
    principal.require_object(service.get_asset(db, UUID(principal.property_id), asset_id))
    rows = service.asset_readings(db, asset_id, metric=metric, hours=hours)
    return [SensorReadingOut.model_validate(r) for r in rows]


@assets_router.post("/readings", response_model=dict, status_code=status.HTTP_202_ACCEPTED)
def record_readings(
    body: list[SensorReadingIn],
    principal: Principal = Depends(requires(Perm.PROPERTY_WRITE)),
    db: Session = Depends(get_session),
) -> dict:
    """BMS connector push endpoint."""
    for reading in body:
        principal.require_object(service.get_asset(db, UUID(principal.property_id), reading.asset_id))
    written = service.record_readings(db, UUID(principal.property_id), body)
    return {"accepted": written}
