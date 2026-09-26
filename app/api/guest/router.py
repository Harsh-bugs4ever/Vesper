"""Two audiences, two routers.

`/guest/*` is the QR page: no account, a stay-scoped token, and every write re-checks
that the stay is still open. `/requests/*` and `/issues/*` are the staff inbox behind the
normal permission matrix.
"""
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm
from vesper_common.security import Principal, current_guest, current_user, requires
from app.api.property import service as property_service
from app.api.property.schemas import AmenityOut, GuestRoomOut, RoomImageOut

from . import service
from .schemas import (
    GuestCreate,
    GuestOut,
    GuestSession,
    IssueCreate,
    IssueOut,
    IssueStatusUpdate,
    MenuItemOut,
    MenuOut,
    PhotoUploadOut,
    QrScanRequest,
    RatingCreate,
    RequestCreate,
    RequestDetail,
    RequestOut,
    RequestStatusUpdate,
)

guest_router = APIRouter(prefix="/guest", tags=["guest-qr"])
requests_router = APIRouter(prefix="/requests", tags=["requests"])
issues_router = APIRouter(prefix="/issues", tags=["issues"])
def _guest_directory_scope(principal: Principal = Depends(current_user), db: Session = Depends(get_session)) -> None:
    principal.require_department_key(db, "front_office")


guests_router = APIRouter(prefix="/guests", tags=["guests"], dependencies=[Depends(_guest_directory_scope)])

# Demo-grade photo storage: a mounted volume, not S3. Swapping this for object storage
# is a one-function change and explicitly on the backlog.
UPLOAD_DIR = Path("/data/uploads")
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_BYTES = 8 * 1024 * 1024


def active_guest(principal: Principal = Depends(current_guest)) -> Principal:
    service.assert_stay_open(principal.stay_id, principal.property_id,
                             room_id=principal.room_id, guest_id=principal.guest_id)
    return principal


def _detail(request) -> RequestDetail:
    return RequestDetail(
        **RequestOut.model_validate(request).model_dump(),
        is_overdue=request.is_overdue,
        department_id=request.department_id,
    )


@guest_router.post("/session", response_model=GuestSession)
def open_session(
    body: QrScanRequest, request: Request, db: Session = Depends(get_session)
) -> GuestSession:
    """Scan the nightstand QR. No login, no app."""
    session = service.open_session(db, body, user_agent=request.headers.get("user-agent"))
    return GuestSession(**session)


@guest_router.get("/menu", response_model=MenuOut)
def guest_menu(
    principal: Principal = Depends(active_guest), db: Session = Depends(get_session)
) -> MenuOut:
    data = service.menu(db, UUID(principal.property_id))
    return MenuOut(
        currency=data["currency"],
        categories={
            name: [MenuItemOut.model_validate(i) for i in items]
            for name, items in data["categories"].items()
        },
    )


@guest_router.get("/amenities", response_model=list[AmenityOut])
def guest_amenities(principal: Principal = Depends(active_guest),
                    db: Session = Depends(get_session)) -> list[AmenityOut]:
    return [AmenityOut.model_validate(a) for a in
            property_service.list_amenities(db, UUID(principal.property_id))]


@guest_router.get("/room", response_model=GuestRoomOut)
def guest_room(principal: Principal = Depends(active_guest),
               db: Session = Depends(get_session)) -> GuestRoomOut:
    room = property_service.get_room(db, UUID(principal.property_id), UUID(principal.room_id))
    return GuestRoomOut(id=room.id, number=room.number, floor=room.floor,
                        category_name=room.category.name,
                        category_amenities=room.category.amenities,
                        images=[RoomImageOut.model_validate(i) for i in room.images])


@guest_router.post("/requests", response_model=RequestDetail, status_code=status.HTTP_201_CREATED)
def raise_request(
    body: RequestCreate,
    principal: Principal = Depends(active_guest),
    db: Session = Depends(get_session),
) -> RequestDetail:
    stay = service.assert_stay_open(principal.stay_id, principal.property_id)
    created = service.create_request(
        db,
        property_id=UUID(principal.property_id),
        stay_id=UUID(principal.stay_id),
        room_id=UUID(principal.room_id),
        room_number=stay.get("room_number", ""),
        guest_id=UUID(principal.guest_id) if principal.guest_id else None,
        data=body,
        actor_id=principal.guest_id,
    )
    return _detail(created)


@guest_router.get("/requests", response_model=list[RequestDetail])
def my_requests(
    principal: Principal = Depends(active_guest), db: Session = Depends(get_session)
) -> list[RequestDetail]:
    """The live tracker on the guest's phone."""
    rows = service.list_stay_requests(
        db, UUID(principal.property_id), UUID(principal.stay_id)
    )
    return [_detail(r) for r in rows]


@guest_router.get("/served-by", response_model=list[dict])
def served_by(
    principal: Principal = Depends(active_guest), db: Session = Depends(get_session)
) -> list[dict]:
    """The staff who attended to this stay.

    Read by guest-intel to decide who this guest is allowed to rate. Returns ids rather
    than names: guest-service does not hold the staff directory, and inventing a name
    here would mean two places that disagree about what someone is called.
    """
    return service.staff_who_served(db, UUID(principal.property_id), UUID(principal.stay_id))


@guest_router.post("/requests/{request_id}/rating", response_model=RequestDetail)
def rate(
    request_id: UUID,
    body: RatingCreate,
    principal: Principal = Depends(active_guest),
    db: Session = Depends(get_session),
) -> RequestDetail:
    """One tap, five stars, no survey."""
    rated = service.rate_request(
        db, UUID(principal.property_id), request_id, UUID(principal.stay_id), body
    )
    return _detail(rated)


@guest_router.post("/issues", response_model=IssueOut, status_code=status.HTTP_201_CREATED)
def guest_report_issue(
    body: IssueCreate,
    principal: Principal = Depends(active_guest),
    db: Session = Depends(get_session),
) -> IssueOut:
    service.assert_stay_open(principal.stay_id, principal.property_id)
    body.room_id = UUID(principal.room_id)  # a guest may only report their own room
    issue = service.report_issue(
        db, UUID(principal.property_id), body, reported_by=None, by_guest=True
    )
    return IssueOut.model_validate(issue)


@requests_router.get("", response_model=list[RequestDetail])
def inbox(
    department_id: UUID | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    principal: Principal = Depends(requires(Perm.REQUESTS_READ)),
    db: Session = Depends(get_session),
) -> list[RequestDetail]:
    scope = principal.scoped_department(department_id)
    rows = service.list_requests(
        db, UUID(principal.property_id), department_id=scope, status=status_filter
    )
    return [_detail(r) for r in rows]


@requests_router.post("/{request_id}/accept", response_model=RequestDetail)
def accept(
    request_id: UUID,
    principal: Principal = Depends(requires(Perm.REQUESTS_ACCEPT)),
    db: Session = Depends(get_session),
) -> RequestDetail:
    principal.require_object(service.get_request(db, UUID(principal.property_id), request_id), owner_field="accepted_by")
    accepted = service.accept_request(
        db, UUID(principal.property_id), request_id, UUID(principal.id)
    )
    return _detail(accepted)


@requests_router.put("/{request_id}/status", response_model=RequestDetail)
def set_status(
    request_id: UUID,
    body: RequestStatusUpdate,
    principal: Principal = Depends(requires(Perm.REQUESTS_ACCEPT)),
    db: Session = Depends(get_session),
) -> RequestDetail:
    principal.require_object(service.get_request(db, UUID(principal.property_id), request_id), owner_field="accepted_by")
    updated = service.set_request_status(
        db, UUID(principal.property_id), request_id, body.status.value, actor_id=principal.id
    )
    return _detail(updated)


@requests_router.post("/sweep-overdue", response_model=dict)
def sweep_overdue(
    principal: Principal = Depends(requires(Perm.REQUESTS_READ)),
    db: Session = Depends(get_session),
) -> dict:
    """Called on a timer by notification-service; alerts each request exactly once."""
    if principal.role != "service":
        from vesper_common.errors import Forbidden
        raise Forbidden("Service access required")
    overdue = service.sweep_overdue(db, UUID(principal.property_id))
    return {"alerted": len(overdue)}


@issues_router.post("", response_model=IssueOut, status_code=status.HTTP_201_CREATED)
def report_issue(
    body: IssueCreate,
    principal: Principal = Depends(requires(Perm.ISSUES_WRITE)),
    db: Session = Depends(get_session),
) -> IssueOut:
    """Staff report a broken item. Near-duplicates merge into the first report."""
    issue = service.report_issue(
        db, UUID(principal.property_id), body, reported_by=UUID(principal.id)
    )
    return IssueOut.model_validate(issue)


@issues_router.get("", response_model=list[IssueOut])
def list_issues(
    status_filter: str | None = Query(default=None, alias="status"),
    principal: Principal = Depends(requires(Perm.ISSUES_WRITE)),
    db: Session = Depends(get_session),
) -> list[IssueOut]:
    rows = [row for row in service.list_issues(db, UUID(principal.property_id), status=status_filter) if principal.can_see_department(row.department_id) or str(row.reported_by) == principal.id]
    return [IssueOut.model_validate(r) for r in rows]


@issues_router.put("/{issue_id}/status", response_model=IssueOut)
def set_issue_status(
    issue_id: UUID,
    body: IssueStatusUpdate,
    principal: Principal = Depends(requires(Perm.REPORTS_APPROVE)),
    db: Session = Depends(get_session),
) -> IssueOut:
    from .models import IssueReport
    issue_row = db.get(IssueReport, issue_id)
    if issue_row is None:
        from vesper_common.errors import NotFound
        raise NotFound("Issue not found")
    principal.require_object(issue_row, owner_field="reported_by")
    issue = service.set_issue_status(
        db, UUID(principal.property_id), issue_id, body.status.value
    )
    return IssueOut.model_validate(issue)


@issues_router.post("/photo", response_model=PhotoUploadOut)
async def upload_photo(
    file: UploadFile = File(...),
    _: Principal = Depends(requires(Perm.ISSUES_WRITE)),
) -> PhotoUploadOut:
    """Attach a photo to an issue report — a picture of the broken AC beats a paragraph."""
    from vesper_common.errors import Invalid

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise Invalid(
            "Photos must be JPEG, PNG or WebP", details={"content_type": file.content_type}
        )
    content = await file.read()
    if len(content) > MAX_PHOTO_BYTES:
        raise Invalid("Photo is larger than 8MB")

    suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[file.content_type]
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{uuid4().hex}{suffix}"
    (UPLOAD_DIR / name).write_bytes(content)
    return PhotoUploadOut(url=f"/uploads/{name}")


@guests_router.get("", response_model=list[GuestOut])
def list_guests(
    search: str | None = None,
    principal: Principal = Depends(requires(Perm.GUESTS_READ)),
    db: Session = Depends(get_session),
) -> list[GuestOut]:
    rows = service.list_guests(db, UUID(principal.property_id), search=search)
    return [GuestOut.model_validate(r) for r in rows]


@guests_router.post("", response_model=GuestOut, status_code=status.HTTP_201_CREATED)
def create_guest(
    body: GuestCreate,
    principal: Principal = Depends(requires(Perm.BOOKINGS_WRITE)),
    db: Session = Depends(get_session),
) -> GuestOut:
    return GuestOut.model_validate(service.create_guest(db, UUID(principal.property_id), body))


@guests_router.get("/{guest_id}", response_model=GuestOut)
def get_guest(
    guest_id: UUID,
    principal: Principal = Depends(requires(Perm.GUESTS_READ)),
    db: Session = Depends(get_session),
) -> GuestOut:
    return GuestOut.model_validate(
        service.get_guest(db, UUID(principal.property_id), guest_id)
    )


@guests_router.get("/{guest_id}/requests", response_model=list[RequestDetail])
def guest_history(
    guest_id: UUID,
    principal: Principal = Depends(requires(Perm.GUESTS_READ)),
    db: Session = Depends(get_session),
) -> list[RequestDetail]:
    """Every order and complaint this person has ever raised — the raw Guest DNA input."""
    from sqlalchemy import select

    from .models import ServiceRequest

    rows = db.scalars(
        select(ServiceRequest)
        .where(
            ServiceRequest.property_id == UUID(principal.property_id),
            ServiceRequest.guest_id == guest_id,
        )
        .order_by(ServiceRequest.created_at.desc())
    )
    return [_detail(r) for r in rows if principal.role in {"gm", "service"} or principal.can_see_department(r.department_id)]
