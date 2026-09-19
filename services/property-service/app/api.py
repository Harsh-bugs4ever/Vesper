from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm
from vesper_common.security import Principal, current_user, requires

from . import service
from .schemas import (
    AssetCreate,
    AssetOut,
    AssetServiced,
    DepartmentOut,
    ImportResult,
    PropertyOut,
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
rooms_router = APIRouter(prefix="/rooms", tags=["rooms"])
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
def property_ids(db: Session = Depends(get_session)) -> list[str]:
    """Every property id this deployment serves.

    Used by scheduled jobs, which have to cover all properties and have no property to
    scope a token to until they have this list. It returns ids and nothing else, so it
    carries no information worth protecting.
    """
    return [str(pid) for pid in service.list_property_ids(db)]


@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(
    principal: Principal = Depends(current_user), db: Session = Depends(get_session)
) -> list[DepartmentOut]:
    rows = service.list_departments(db, UUID(principal.property_id))
    return [DepartmentOut.model_validate(r) for r in rows]


@router.get("/room-categories", response_model=list[RoomCategoryOut])
def list_categories(
    principal: Principal = Depends(current_user), db: Session = Depends(get_session)
) -> list[RoomCategoryOut]:
    rows = service.list_categories(db, UUID(principal.property_id))
    return [RoomCategoryOut.model_validate(r) for r in rows]


@router.get("/occupancy", response_model=dict)
def occupancy(
    principal: Principal = Depends(current_user), db: Session = Depends(get_session)
) -> dict:
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
    rows = service.list_assets(db, UUID(principal.property_id), asset_type=asset_type)
    return [AssetOut.model_validate(r) for r in rows]


@assets_router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(
    body: AssetCreate,
    principal: Principal = Depends(requires(Perm.PROPERTY_WRITE)),
    db: Session = Depends(get_session),
) -> AssetOut:
    return AssetOut.model_validate(service.create_asset(db, UUID(principal.property_id), body))


@assets_router.get("/{asset_id}", response_model=AssetOut)
def get_asset(
    asset_id: UUID,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> AssetOut:
    return AssetOut.model_validate(service.get_asset(db, UUID(principal.property_id), asset_id))


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
    service.get_asset(db, UUID(principal.property_id), asset_id)  # scope check
    rows = service.asset_readings(db, asset_id, metric=metric, hours=hours)
    return [SensorReadingOut.model_validate(r) for r in rows]


@assets_router.post("/readings", response_model=dict, status_code=status.HTTP_202_ACCEPTED)
def record_readings(
    body: list[SensorReadingIn],
    principal: Principal = Depends(requires(Perm.PROPERTY_WRITE)),
    db: Session = Depends(get_session),
) -> dict:
    """BMS connector push endpoint."""
    written = service.record_readings(db, UUID(principal.property_id), body)
    return {"accepted": written}
