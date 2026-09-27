from uuid import UUID
from decimal import Decimal
import json
import logging

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm, Role
from vesper_common.security import Principal, current_user, requires
from vesper_common.errors import Conflict, Forbidden, NotFound
from vesper_common.config import settings

from . import procurement, reorder, service
from .models import DepartmentBudget, StockItem
from app.api.property.models import Department
from .schemas import (
    InventorySummary,
    PurchaseApprove,
    PurchaseOrderOut,
    PurchaseReceive,
    PurchaseReturn,
    RequisitionCreate,
    RequisitionDecision,
    RequisitionOut,
    RequisitionLineCreate,
    BudgetWrite,
    BudgetAllocationUpdate,
    BudgetOut,
    StockItemCreate,
    StockItemDetail,
    StockItemOut,
    StockItemUpdate,
    StockMoveRequest,
    StockMovementOut,
    ReorderAnalysis,
    ReorderAlert,
    RequisitionCatalogItemOut,
    RequisitionDraftRequest,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])
purchase_router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])
log = logging.getLogger(__name__)


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
    raise Forbidden("Department replenishment is automatic. Use the inventory view to check stock levels.")


@router.get("/requisitions/mine", response_model=list[RequisitionOut])
def my_requisitions(principal: Principal = Depends(requires(Perm.REQUISITION_WRITE)),
                    db: Session = Depends(get_session)) -> list[RequisitionOut]:
    rows = procurement.list_requests(db, UUID(principal.property_id), requester_id=UUID(principal.id))
    return [RequisitionOut.model_validate(row) for row in rows]


@router.get("/requisitions/catalog", response_model=list[RequisitionCatalogItemOut])
def requisition_catalog(principal: Principal = Depends(requires(Perm.REQUISITION_WRITE)),
                        db: Session = Depends(get_session)) -> list[RequisitionCatalogItemOut]:
    """Staff requisition choices; stock catalog visibility is separate from ledger access."""
    if principal.role != Role.STAFF:
        raise Forbidden("Staff account required")
    rows = service.list_items(db, UUID(principal.property_id))
    return [RequisitionCatalogItemOut.model_validate(row) for row in rows]


@router.post("/requisitions/draft", response_model=dict)
def draft_requisition(body: RequisitionDraftRequest,
                      principal: Principal = Depends(requires(Perm.REQUISITION_WRITE)),
                      db: Session = Depends(get_session)) -> dict:
    """Generate a reviewable request suggestion for this staff member's department."""
    if principal.role != Role.STAFF:
        raise Forbidden("Staff account required")
    department_id = principal.scoped_department(None)
    principal.require_department_record(db, department_id)
    department = db.get(Department, department_id)
    department_name = department.name if department else "your department"
    items = service.list_items(db, UUID(principal.property_id))
    if not items:
        return {"source": "inventory_rules", "reason": "No stock items are available yet.", "items": []}

    department_key = department.key if department else ""
    relevant_categories = {
        "housekeeping": {"linen", "toiletries", "cleaning", "beds"},
        "fnb": {"food", "beverage"},
        "maintenance": {"spare_parts", "cleaning"},
        "front_office": {"toiletries"},
        "security": {"spare_parts", "cleaning"},
    }.get(department_key, {item.category for item in items})
    department_items = [item for item in items if item.category in relevant_categories]
    automatic = bool(body.need and body.need.startswith("[AUTO_REPLENISH]"))
    draft_items = [item for item in department_items if item.is_low] if automatic else department_items
    by_sku = {item.sku: item for item in draft_items}
    suggestions: list[dict] = []
    suggested_ids: set[UUID] = set()
    source = "inventory_rules"
    reason = f"Suggested replenishment for {department_name} based on current stock."
    if settings.groq_api_key and draft_items:
        try:
            import groq
            client = groq.Groq(api_key=settings.groq_api_key, timeout=20.0, max_retries=1)
            catalog = [{"sku": item.sku, "name": item.name, "category": item.category,
                        "unit": item.unit, "on_hand": float(item.quantity),
                        "minimum": float(item.minimum_quantity), "reorder": float(item.reorder_quantity)}
                       for item in draft_items]
            prompt = (
                "Create a small inventory requisition draft for hotel staff. Use only catalog SKUs. "
                "Return JSON with reason and items [{sku, quantity, reason}]. Choose at most 4 relevant "
                "items; quantity must be positive and no more than 100. It is only a draft for a human to review.\n"
                f"Department: {department_name}\nNeed/context: {body.need or 'routine shift replenishment'}\n"
                f"Catalog: {json.dumps(catalog, ensure_ascii=False)}"
            )
            response = client.chat.completions.create(
                model=settings.concierge_model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            content = response.choices[0].message.content or "{}"
            result = json.loads(content)
            for row in result.get("items", [])[:4]:
                item = by_sku.get(str(row.get("sku", "")))
                quantity = float(row.get("quantity", 0))
                if item and item.id not in suggested_ids and 0 < quantity <= 100:
                    suggested_ids.add(item.id)
                    suggestions.append({"item_id": str(item.id), "sku": item.sku, "name": item.name,
                                        "quantity": quantity, "reason": str(row.get("reason", "Shift replenishment"))[:240]})
            if suggestions:
                source = "ai"
                reason = str(result.get("reason") or reason)[:500]
        except Exception:
            log.warning("AI requisition draft failed; using stock rules", exc_info=True)

    if not suggestions:
        candidates = sorted(
            (item for item in draft_items if item.is_low) if automatic else draft_items,
            key=lambda item: (not item.is_low, float(item.quantity) / max(float(item.minimum_quantity), 1.0)),
        )
        for item in candidates[:3]:
            quantity = max(1.0, min(100.0, float(item.reorder_quantity or 1)))
            suggestions.append({"item_id": str(item.id), "sku": item.sku, "name": item.name,
                                "quantity": quantity, "reason": "Replenish for the upcoming shift"})
    if not suggestions:
        reason = f"No suitable stock items are available for {department_name} yet."
    return {"source": source, "reason": reason, "items": suggestions}


@router.post("/requisitions/auto-submit", response_model=dict, status_code=status.HTTP_201_CREATED)
def auto_submit_requisition(body: RequisitionDraftRequest,
                             principal: Principal = Depends(requires(Perm.REQUISITION_WRITE)),
                             db: Session = Depends(get_session)) -> dict:
    """Compatibility response: scheduled replenishment owns request creation."""
    return {"created": False, "source": "inventory_rules",
            "message": "Department stock is monitored automatically. Replenishment requests appear in the department dashboard.",
            "request": None}


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
        principal: Principal = Depends(current_user)) -> RequisitionOut:
    raise Forbidden("Stock replenishment is automated; department stock requests are read-only.")


@router.post("/requisitions/{request_id}/reject", response_model=RequisitionOut)
def reject_requisition(request_id: UUID, body: RequisitionDecision,
        principal: Principal = Depends(current_user)) -> RequisitionOut:
    raise Forbidden("Stock replenishment is automated; department stock requests are read-only.")


@router.post("/requisitions/{request_id}/cancel", response_model=RequisitionOut)
def cancel_requisition(request_id: UUID, body: RequisitionDecision,
        principal: Principal = Depends(requires(Perm.REQUISITION_WRITE)),
        db: Session = Depends(get_session)) -> RequisitionOut:
    raise Forbidden("Automatic department stock requests are read-only.")


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


@router.get("/reorder-alerts", response_model=list[ReorderAlert])
def reorder_alerts(principal: Principal = Depends(requires(Perm.STOCK_READ)),
                   db: Session = Depends(get_session)) -> list[ReorderAlert]:
    rows = []
    for item in service.list_items(db, UUID(principal.property_id)):
        if principal.role not in {Role.GM, "service"} and not principal.can_see_department(item.department_id):
            continue
        analysis = reorder.analyze(db, item)
        if analysis["status"] != "healthy":
            rows.append(ReorderAlert(**analysis, name=item.name, sku=item.sku, unit=item.unit))
    return rows


@router.get("/reorder-analysis", response_model=list[ReorderAnalysis])
def all_reorder_analysis(principal: Principal = Depends(requires(Perm.STOCK_READ)),
                         db: Session = Depends(get_session)) -> list[ReorderAnalysis]:
    return [ReorderAnalysis(**reorder.analyze(db, item))
            for item in service.list_items(db, UUID(principal.property_id))
            if principal.role in {Role.GM, "service"} or principal.can_see_department(item.department_id)]


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


@router.get("/items/{item_id}/reorder-analysis", response_model=ReorderAnalysis)
def reorder_analysis(item_id: UUID, principal: Principal = Depends(requires(Perm.STOCK_READ)),
                     db: Session = Depends(get_session)) -> ReorderAnalysis:
    item = service.get_item(db, UUID(principal.property_id), item_id)
    principal.require_object(item)
    return ReorderAnalysis(**reorder.analyze(db, item))


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
