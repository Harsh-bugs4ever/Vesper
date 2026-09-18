from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm
from vesper_common.security import Principal, requires

from . import service
from .models import StockItem
from .schemas import (
    InventorySummary,
    PurchaseApprove,
    PurchaseOrderOut,
    StockItemCreate,
    StockItemDetail,
    StockItemOut,
    StockItemUpdate,
    StockMoveRequest,
    StockMovementOut,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])
purchase_router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])


def _detail(item: StockItem) -> StockItemDetail:
    return StockItemDetail(
        **StockItemOut.model_validate(item).model_dump(),
        is_low=item.is_low,
        days_to_expiry=item.days_to_expiry,
    )


@router.get("/items", response_model=list[StockItemDetail])
def list_items(
    category: str | None = None,
    low_only: bool = False,
    expiring_only: bool = False,
    search: str | None = None,
    principal: Principal = Depends(requires(Perm.STOCK_READ)),
    db: Session = Depends(get_session),
) -> list[StockItemDetail]:
    items = service.list_items(
        db,
        UUID(principal.property_id),
        category=category,
        low_only=low_only,
        expiring_only=expiring_only,
        search=search,
    )
    return [_detail(i) for i in items]


@router.post("/items", response_model=StockItemDetail, status_code=status.HTTP_201_CREATED)
def create_item(
    body: StockItemCreate,
    principal: Principal = Depends(requires(Perm.STOCK_WRITE)),
    db: Session = Depends(get_session),
) -> StockItemDetail:
    item = StockItem(property_id=UUID(principal.property_id), **body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _detail(item)


@router.get("/summary", response_model=InventorySummary)
def summary(
    principal: Principal = Depends(requires(Perm.STOCK_READ)),
    db: Session = Depends(get_session),
) -> InventorySummary:
    return InventorySummary(**service.summary(db, UUID(principal.property_id)))


@router.post("/sweep-expiring", response_model=dict)
def sweep_expiring(
    principal: Principal = Depends(requires(Perm.STOCK_WRITE)),
    db: Session = Depends(get_session),
) -> dict:
    """Daily job: badge anything inside the expiry warning window."""
    items = service.sweep_expiring(db, UUID(principal.property_id))
    return {"flagged": len(items)}


@router.get("/items/{item_id}", response_model=StockItemDetail)
def get_item(
    item_id: UUID,
    principal: Principal = Depends(requires(Perm.STOCK_READ)),
    db: Session = Depends(get_session),
) -> StockItemDetail:
    return _detail(service.get_item(db, UUID(principal.property_id), item_id))


@router.patch("/items/{item_id}", response_model=StockItemDetail)
def update_item(
    item_id: UUID,
    body: StockItemUpdate,
    principal: Principal = Depends(requires(Perm.STOCK_WRITE)),
    db: Session = Depends(get_session),
) -> StockItemDetail:
    item = service.get_item(db, UUID(principal.property_id), item_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    # A raised minimum can put an item below the line without any stock moving.
    service.maybe_flag_low(db, UUID(principal.property_id), item)
    return _detail(item)


@router.post("/items/{item_id}/movements", response_model=StockMovementOut, status_code=status.HTTP_201_CREATED)
def move_stock(
    item_id: UUID,
    body: StockMoveRequest,
    principal: Principal = Depends(requires(Perm.STOCK_WRITE)),
    db: Session = Depends(get_session),
) -> StockMovementOut:
    movement = service.move_stock(
        db,
        UUID(principal.property_id),
        item_id,
        body.quantity,
        body.reason.value,
        actor_id=UUID(principal.id),
        note=body.note,
    )
    return StockMovementOut.model_validate(movement)


@router.get("/items/{item_id}/movements", response_model=list[StockMovementOut])
def item_movements(
    item_id: UUID,
    limit: int = Query(default=100, ge=1, le=500),
    principal: Principal = Depends(requires(Perm.STOCK_READ)),
    db: Session = Depends(get_session),
) -> list[StockMovementOut]:
    rows = service.item_movements(db, UUID(principal.property_id), item_id, limit=limit)
    return [StockMovementOut.model_validate(r) for r in rows]


@purchase_router.get("", response_model=list[PurchaseOrderOut])
def list_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    principal: Principal = Depends(requires(Perm.STOCK_READ)),
    db: Session = Depends(get_session),
) -> list[PurchaseOrderOut]:
    rows = service.list_purchase_orders(db, UUID(principal.property_id), status=status_filter)
    return [PurchaseOrderOut.model_validate(r) for r in rows]


@purchase_router.post("/{order_id}/approve", response_model=PurchaseOrderOut)
def approve(
    order_id: UUID,
    body: PurchaseApprove,
    principal: Principal = Depends(requires(Perm.PURCHASE_APPROVE)),
    db: Session = Depends(get_session),
) -> PurchaseOrderOut:
    order = service.approve_purchase_order(
        db, UUID(principal.property_id), order_id, actor_id=UUID(principal.id), quantity=body.quantity
    )
    return PurchaseOrderOut.model_validate(order)


@purchase_router.post("/{order_id}/receive", response_model=PurchaseOrderOut)
def receive(
    order_id: UUID,
    principal: Principal = Depends(requires(Perm.STOCK_WRITE)),
    db: Session = Depends(get_session),
) -> PurchaseOrderOut:
    order = service.receive_purchase_order(
        db, UUID(principal.property_id), order_id, actor_id=UUID(principal.id)
    )
    return PurchaseOrderOut.model_validate(order)


@purchase_router.post("/{order_id}/cancel", response_model=PurchaseOrderOut)
def cancel(
    order_id: UUID,
    principal: Principal = Depends(requires(Perm.PURCHASE_APPROVE)),
    db: Session = Depends(get_session),
) -> PurchaseOrderOut:
    order = service.cancel_purchase_order(db, UUID(principal.property_id), order_id)
    return PurchaseOrderOut.model_validate(order)
