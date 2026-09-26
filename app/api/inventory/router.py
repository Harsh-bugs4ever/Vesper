from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm, Role
from vesper_common.security import Principal, current_user, requires
from vesper_common.errors import Forbidden, NotFound

from . import procurement, service
from .models import DepartmentBudget, StockItem
from .schemas import (
    InventorySummary,
    PurchaseApprove,
    PurchaseOrderOut,
    PurchaseReceive,
    PurchaseReturn,
    RequisitionCreate,
    RequisitionDecision,
    RequisitionOut,
    BudgetWrite,
    BudgetAllocationUpdate,
    BudgetOut,
    StockItemCreate,
    StockItemDetail,
    StockItemOut,
    StockItemUpdate,
    StockMoveRequest,
    StockMovementOut,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])
purchase_router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])


def _po_access(principal: Principal, order) -> None:
    principal.require_property(order.property_id)
    if principal.role in {Role.GM, "service"}:
        return
    if principal.role != Role.MANAGER or not principal.can_see_department(order.department_id):
        raise NotFound("Purchase order not found")


def _request_manager(principal: Principal, row) -> None:
    principal.require_property(row.property_id)
    if (principal.role != Role.MANAGER or
            not principal.can_see_department(row.department_id) or
            str(row.responsible_manager_id) != principal.id):
        raise Forbidden("Only the responsible department manager may decide this request")


@router.post("/requisitions", response_model=RequisitionOut, status_code=status.HTTP_201_CREATED)
def submit_requisition(body: RequisitionCreate,
                       principal: Principal = Depends(requires(Perm.REQUISITION_WRITE)),
                       db: Session = Depends(get_session)) -> RequisitionOut:
    if principal.role != Role.STAFF:
        raise Forbidden("Staff account required to submit a requisition")
    department_id = principal.scoped_department(None)
    principal.require_department_record(db, department_id)
    return RequisitionOut.model_validate(procurement.create_request(
        db, UUID(principal.property_id), department_id, UUID(principal.id), body))


@router.get("/requisitions/mine", response_model=list[RequisitionOut])
def my_requisitions(principal: Principal = Depends(requires(Perm.REQUISITION_WRITE)),
                    db: Session = Depends(get_session)) -> list[RequisitionOut]:
    rows = procurement.list_requests(db, UUID(principal.property_id), requester_id=UUID(principal.id))
    return [RequisitionOut.model_validate(row) for row in rows]


@router.get("/requisitions", response_model=list[RequisitionOut])
def department_requisitions(department_id: UUID | None = None,
        principal: Principal = Depends(requires(Perm.REQUISITION_READ)),
        db: Session = Depends(get_session)) -> list[RequisitionOut]:
    if principal.role not in {Role.MANAGER, Role.GM, "service"}:
        raise Forbidden("Manager or oversight access required")
    scope = principal.scoped_department(department_id)
    rows = procurement.list_requests(db, UUID(principal.property_id), department_id=scope)
    return [RequisitionOut.model_validate(row) for row in rows
            if principal.role in {Role.GM, "service"} or principal.can_see_department(row.department_id)]


@router.get("/requisitions/{request_id}", response_model=RequisitionOut)
def get_requisition(request_id: UUID, principal: Principal = Depends(current_user),
                    db: Session = Depends(get_session)) -> RequisitionOut:
    row = procurement.get_request(db, UUID(principal.property_id), request_id)
    if str(row.requested_by) != principal.id:
        principal.require(Perm.REQUISITION_READ)
        if principal.role not in {Role.GM, "service"} and not principal.can_see_department(row.department_id):
            raise NotFound("Inventory request not found")
    return RequisitionOut.model_validate(row)


@router.post("/requisitions/{request_id}/approve", response_model=RequisitionOut)
def approve_requisition(request_id: UUID, body: RequisitionDecision,
        principal: Principal = Depends(requires(Perm.REQUISITION_APPROVE)),
        db: Session = Depends(get_session)) -> RequisitionOut:
    row = procurement.get_request(db, UUID(principal.property_id), request_id)
    _request_manager(principal, row)
    return RequisitionOut.model_validate(procurement.decide_request(
        db, UUID(principal.property_id), request_id, UUID(principal.id),
        approve=True, reason=body.reason))


@router.post("/requisitions/{request_id}/reject", response_model=RequisitionOut)
def reject_requisition(request_id: UUID, body: RequisitionDecision,
        principal: Principal = Depends(requires(Perm.REQUISITION_APPROVE)),
        db: Session = Depends(get_session)) -> RequisitionOut:
    row = procurement.get_request(db, UUID(principal.property_id), request_id)
    _request_manager(principal, row)
    return RequisitionOut.model_validate(procurement.decide_request(
        db, UUID(principal.property_id), request_id, UUID(principal.id),
        approve=False, reason=body.reason))


@router.post("/requisitions/{request_id}/cancel", response_model=RequisitionOut)
def cancel_requisition(request_id: UUID, body: RequisitionDecision,
        principal: Principal = Depends(requires(Perm.REQUISITION_WRITE)),
        db: Session = Depends(get_session)) -> RequisitionOut:
    return RequisitionOut.model_validate(procurement.cancel_request(
        db, UUID(principal.property_id), request_id, UUID(principal.id), body.reason))


@router.post("/budgets", response_model=BudgetOut, status_code=status.HTTP_201_CREATED)
def create_budget(body: BudgetWrite,
        principal: Principal = Depends(requires(Perm.BUDGET_MANAGE)),
        db: Session = Depends(get_session)) -> BudgetOut:
    if principal.role != Role.GM:
        raise Forbidden("General Manager allocation authority required")
    principal.require_department_record(db, body.department_id)
    row = procurement.create_budget(db, UUID(principal.property_id), body)
    return BudgetOut.model_validate(procurement.budget_view(db, row))


@router.get("/budgets", response_model=list[BudgetOut])
def list_budgets(department_id: UUID | None = None,
        principal: Principal = Depends(requires(Perm.BUDGET_READ)),
        db: Session = Depends(get_session)) -> list[BudgetOut]:
    scope = principal.scoped_department(department_id)
    from sqlalchemy import select
    query = select(DepartmentBudget).where(DepartmentBudget.property_id == UUID(principal.property_id))
    if scope is not None:
        query = query.where(DepartmentBudget.department_id == scope)
    rows = db.scalars(query.order_by(DepartmentBudget.period_start.desc())).all()
    return [BudgetOut.model_validate(procurement.budget_view(db, row)) for row in rows]


@router.put("/budgets/{budget_id}/allocation", response_model=BudgetOut)
def update_budget_allocation(budget_id: UUID, body: BudgetAllocationUpdate,
        principal: Principal = Depends(requires(Perm.BUDGET_MANAGE)),
        db: Session = Depends(get_session)) -> BudgetOut:
    if principal.role != Role.GM:
        raise Forbidden("General Manager allocation authority required")
    row = procurement.change_allocation(db, UUID(principal.property_id), budget_id, body.allocated)
    return BudgetOut.model_validate(procurement.budget_view(db, row))


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
    return [_detail(i) for i in items if principal.role in {Role.GM, "service"} or principal.can_see_department(i.department_id)]


@router.post("/items", response_model=StockItemDetail, status_code=status.HTTP_201_CREATED)
def create_item(
    body: StockItemCreate,
    principal: Principal = Depends(requires(Perm.STOCK_WRITE)),
    db: Session = Depends(get_session),
) -> StockItemDetail:
    principal.require_department_record(db, body.department_id)
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
    departments = None if principal.role in {Role.GM, "service"} else principal.department_ids
    return InventorySummary(**service.summary(db, UUID(principal.property_id), department_ids=departments))


@router.post("/sweep-expiring", response_model=dict)
def sweep_expiring(
    principal: Principal = Depends(requires(Perm.STOCK_WRITE)),
    db: Session = Depends(get_session),
) -> dict:
    """Daily job: badge anything inside the expiry warning window."""
    if principal.role not in {"gm", "service"}:
        raise Forbidden("Property-wide sweep requires General Manager access")
    items = service.sweep_expiring(db, UUID(principal.property_id))
    return {"flagged": len(items)}


@router.get("/items/{item_id}", response_model=StockItemDetail)
def get_item(
    item_id: UUID,
    principal: Principal = Depends(requires(Perm.STOCK_READ)),
    db: Session = Depends(get_session),
) -> StockItemDetail:
    item = service.get_item(db, UUID(principal.property_id), item_id)
    principal.require_object(item)
    return _detail(item)


@router.patch("/items/{item_id}", response_model=StockItemDetail)
def update_item(
    item_id: UUID,
    body: StockItemUpdate,
    principal: Principal = Depends(requires(Perm.STOCK_WRITE)),
    db: Session = Depends(get_session),
) -> StockItemDetail:
    item = service.get_item(db, UUID(principal.property_id), item_id)
    principal.require_object(item)
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
    principal.require_object(service.get_item(db, UUID(principal.property_id), item_id))
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
    principal.require_object(service.get_item(db, UUID(principal.property_id), item_id))
    rows = service.item_movements(db, UUID(principal.property_id), item_id, limit=limit)
    return [StockMovementOut.model_validate(r) for r in rows]


@purchase_router.get("", response_model=list[PurchaseOrderOut])
def list_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    principal: Principal = Depends(requires(Perm.PURCHASE_READ)),
    db: Session = Depends(get_session),
) -> list[PurchaseOrderOut]:
    rows = service.list_purchase_orders(db, UUID(principal.property_id), status=status_filter)
    return [PurchaseOrderOut.model_validate(r) for r in rows
            if principal.role in {Role.GM, "service"} or
            (principal.role == Role.MANAGER and principal.can_see_department(r.department_id))]


@purchase_router.get("/{order_id}", response_model=PurchaseOrderOut)
def get_order(order_id: UUID, principal: Principal = Depends(requires(Perm.PURCHASE_READ)),
              db: Session = Depends(get_session)) -> PurchaseOrderOut:
    order = service.get_purchase_order(db, UUID(principal.property_id), order_id)
    _po_access(principal, order)
    return PurchaseOrderOut.model_validate(order)


@purchase_router.post("/{order_id}/approve", response_model=PurchaseOrderOut)
def approve(
    order_id: UUID,
    body: PurchaseApprove,
    principal: Principal = Depends(requires(Perm.PURCHASE_APPROVE)),
    db: Session = Depends(get_session),
) -> PurchaseOrderOut:
    _po_access(principal, service.get_purchase_order(db, UUID(principal.property_id), order_id))
    order = service.approve_purchase_order(
        db, UUID(principal.property_id), order_id, actor_id=UUID(principal.id), quantity=body.quantity
    )
    return PurchaseOrderOut.model_validate(order)


@purchase_router.post("/{order_id}/receive", response_model=PurchaseOrderOut)
def receive(
    order_id: UUID,
    body: PurchaseReceive | None = None,
    principal: Principal = Depends(requires(Perm.STOCK_WRITE)),
    db: Session = Depends(get_session),
) -> PurchaseOrderOut:
    _po_access(principal, service.get_purchase_order(db, UUID(principal.property_id), order_id))
    order = service.receive_purchase_order(
        db, UUID(principal.property_id), order_id, actor_id=UUID(principal.id),
        quantity=body.quantity if body else None, operation_id=body.operation_id if body else None,
    )
    return PurchaseOrderOut.model_validate(order)


@purchase_router.post("/{order_id}/return", response_model=PurchaseOrderOut)
def return_order(order_id: UUID, body: PurchaseReturn,
        principal: Principal = Depends(requires(Perm.STOCK_WRITE)),
        db: Session = Depends(get_session)) -> PurchaseOrderOut:
    _po_access(principal, service.get_purchase_order(db, UUID(principal.property_id), order_id))
    return PurchaseOrderOut.model_validate(service.return_purchase_order(
        db, UUID(principal.property_id), order_id, actor_id=UUID(principal.id),
        quantity=body.quantity, operation_id=body.operation_id, reason=body.reason))


@purchase_router.post("/{order_id}/cancel", response_model=PurchaseOrderOut)
def cancel(
    order_id: UUID,
    principal: Principal = Depends(requires(Perm.PURCHASE_APPROVE)),
    db: Session = Depends(get_session),
) -> PurchaseOrderOut:
    _po_access(principal, service.get_purchase_order(db, UUID(principal.property_id), order_id))
    order = service.cancel_purchase_order(db, UUID(principal.property_id), order_id)
    return PurchaseOrderOut.model_validate(order)
