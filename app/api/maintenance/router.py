from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm
from vesper_common.security import Principal, current_user, requires
from app.api.property.models import Asset
from vesper_common.errors import NotFound

from . import service
from .schemas import (
    AssetHealthOut,
    MaintenanceSummary,
    WorkOrderComplete,
    WorkOrderCreate,
    WorkOrderOut,
)

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


def _asset_scope(db: Session, principal: Principal, asset_id: UUID) -> Asset:
    asset = db.get(Asset, asset_id)
    if asset is None or str(asset.property_id) != principal.property_id:
        raise NotFound("Asset not found")
    principal.require_object(asset)
    return asset


@router.get("/health", response_model=list[AssetHealthOut])
def list_health(
    min_risk: float = Query(default=0.0, ge=0.0, le=1.0),
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> list[AssetHealthOut]:
    principal.require(Perm.MAINTENANCE_RUN)
    """Risk-ranked asset list — the health cards on the maintenance screen."""
    rows = service.list_health(db, UUID(principal.property_id), min_risk=min_risk)
    return [AssetHealthOut.model_validate(r) for r in rows if _visible_asset(db, principal, r.asset_id)]


def _visible_asset(db: Session, principal: Principal, asset_id: UUID) -> bool:
    asset = db.get(Asset, asset_id)
    return bool(asset and str(asset.property_id) == principal.property_id and (principal.role in {"gm", "service"} or principal.can_see_department(asset.department_id)))


@router.get("/summary", response_model=MaintenanceSummary)
def summary(
    principal: Principal = Depends(current_user), db: Session = Depends(get_session)
) -> MaintenanceSummary:
    principal.require(Perm.MAINTENANCE_RUN)
    allowed = None if principal.role in {"gm", "service"} else principal.department_ids
    return MaintenanceSummary(**service.summary(db, UUID(principal.property_id), department_ids=allowed))


@router.post("/assess", response_model=dict)
def assess_all(
    principal: Principal = Depends(requires(Perm.MAINTENANCE_RUN)),
    db: Session = Depends(get_session),
) -> dict:
    """Nightly sweep: score every asset and raise cards above the risk threshold."""
    if principal.role not in {"gm", "service"}:
        from vesper_common.errors import Forbidden
        raise Forbidden("Property-wide assessment requires General Manager access")
    results = service.assess_all(db, UUID(principal.property_id))
    at_risk = [r for r in results if r.risk_score >= service.CARD_RISK_THRESHOLD]
    return {"assessed": len(results), "at_risk": len(at_risk)}


@router.get("/health/{asset_id}", response_model=AssetHealthOut)
def get_health(
    asset_id: UUID,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> AssetHealthOut:
    principal.require(Perm.MAINTENANCE_RUN)
    """One asset's risk gauge, drivers and anomaly markers for the trend chart."""
    _asset_scope(db, principal, asset_id)
    return AssetHealthOut.model_validate(
        service.get_health(db, UUID(principal.property_id), asset_id)
    )


@router.get("/work-orders", response_model=list[WorkOrderOut])
def list_work_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    asset_id: UUID | None = None,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> list[WorkOrderOut]:
    principal.require(Perm.WORKORDER_APPROVE)
    rows = service.list_work_orders(
        db, UUID(principal.property_id), status=status_filter, asset_id=asset_id
    )
    return [WorkOrderOut.model_validate(r) for r in rows if principal.role in {"gm", "service"} or principal.can_see_department(r.department_id)]


@router.post("/work-orders", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
def create_work_order(
    body: WorkOrderCreate,
    principal: Principal = Depends(requires(Perm.WORKORDER_APPROVE)),
    db: Session = Depends(get_session),
) -> WorkOrderOut:
    asset = _asset_scope(db, principal, body.asset_id)
    if body.department_id is None:
        body.department_id = asset.department_id
    if body.department_id != asset.department_id:
        raise NotFound("Asset not found in department")
    if principal.role not in {"gm", "service"}:
        principal.require_department(body.department_id)
    return WorkOrderOut.model_validate(
        service.create_work_order(db, UUID(principal.property_id), body)
    )


@router.post("/work-orders/{order_id}/complete", response_model=WorkOrderOut)
def complete_work_order(
    order_id: UUID,
    body: WorkOrderComplete,
    principal: Principal = Depends(requires(Perm.WORKORDER_APPROVE)),
    db: Session = Depends(get_session),
) -> WorkOrderOut:
    """Closes the order and resets the asset's service clock."""
    principal.require_object(service.get_work_order(db, UUID(principal.property_id), order_id))
    order = service.complete_work_order(
        db, UUID(principal.property_id), order_id, actual_cost=body.actual_cost, notes=body.notes
    )
    return WorkOrderOut.model_validate(order)


@router.post("/work-orders/{order_id}/cancel", response_model=WorkOrderOut)
def cancel_work_order(
    order_id: UUID,
    principal: Principal = Depends(requires(Perm.WORKORDER_APPROVE)),
    db: Session = Depends(get_session),
) -> WorkOrderOut:
    principal.require_object(service.get_work_order(db, UUID(principal.property_id), order_id))
    return WorkOrderOut.model_validate(
        service.cancel_work_order(db, UUID(principal.property_id), order_id)
    )
