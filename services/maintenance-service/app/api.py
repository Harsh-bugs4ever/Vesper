from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm
from vesper_common.security import Principal, current_user, requires

from . import service
from .schemas import (
    AssetHealthOut,
    MaintenanceSummary,
    WorkOrderComplete,
    WorkOrderCreate,
    WorkOrderOut,
)

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("/health", response_model=list[AssetHealthOut])
def list_health(
    min_risk: float = Query(default=0.0, ge=0.0, le=1.0),
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> list[AssetHealthOut]:
    """Risk-ranked asset list — the health cards on the maintenance screen."""
    rows = service.list_health(db, UUID(principal.property_id), min_risk=min_risk)
    return [AssetHealthOut.model_validate(r) for r in rows]


@router.get("/summary", response_model=MaintenanceSummary)
def summary(
    principal: Principal = Depends(current_user), db: Session = Depends(get_session)
) -> MaintenanceSummary:
    return MaintenanceSummary(**service.summary(db, UUID(principal.property_id)))


@router.post("/assess", response_model=dict)
def assess_all(
    principal: Principal = Depends(requires(Perm.MAINTENANCE_RUN)),
    db: Session = Depends(get_session),
) -> dict:
    """Nightly sweep: score every asset and raise cards above the risk threshold."""
    results = service.assess_all(db, UUID(principal.property_id))
    at_risk = [r for r in results if r.risk_score >= service.CARD_RISK_THRESHOLD]
    return {"assessed": len(results), "at_risk": len(at_risk)}


@router.get("/health/{asset_id}", response_model=AssetHealthOut)
def get_health(
    asset_id: UUID,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> AssetHealthOut:
    """One asset's risk gauge, drivers and anomaly markers for the trend chart."""
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
    rows = service.list_work_orders(
        db, UUID(principal.property_id), status=status_filter, asset_id=asset_id
    )
    return [WorkOrderOut.model_validate(r) for r in rows]


@router.post("/work-orders", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
def create_work_order(
    body: WorkOrderCreate,
    principal: Principal = Depends(requires(Perm.WORKORDER_APPROVE)),
    db: Session = Depends(get_session),
) -> WorkOrderOut:
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
    return WorkOrderOut.model_validate(
        service.cancel_work_order(db, UUID(principal.property_id), order_id)
    )
