from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from vesper_common.db import get_session
from vesper_common.permissions import Perm
from vesper_common.security import Principal, current_user, requires, requires_gm

from . import service
from .models import RateSource
from .schemas import (
    CompetitorRow,
    ForecastOut,
    RateApplyRequest,
    RateApplyResult,
    RateCardRow,
    RateHistoryOut,
    RateRestoreRequest,
    SimulateRequest,
    SimulateResult,
)

router = APIRouter(prefix="/revenue", tags=["revenue"])


@router.get("/forecast", response_model=list[ForecastOut])
def forecast(
    days: int = Query(default=30, ge=1, le=90),
    principal: Principal = Depends(requires_gm(Perm.FORECAST_READ)),
    db: Session = Depends(get_session),
) -> list[ForecastOut]:
    """The 30-day demand curve with its confidence band."""
    rows = service.list_forecast(db, UUID(principal.property_id), days=days)
    return [ForecastOut.model_validate(r) for r in rows]


@router.post("/forecast/refresh", response_model=list[ForecastOut])
def refresh_forecast(
    days: int = Query(default=30, ge=1, le=90),
    principal: Principal = Depends(requires_gm(Perm.FORECAST_READ)),
    db: Session = Depends(get_session),
) -> list[ForecastOut]:
    """Refit against the latest booking history. Nightly job; also a button."""
    rows = service.generate_forecast(db, UUID(principal.property_id), horizon=days)
    return [ForecastOut.model_validate(r) for r in rows]


@router.get("/rate-card", response_model=list[RateCardRow])
def rate_card(
    days: int = Query(default=30, ge=1, le=90),
    principal: Principal = Depends(requires_gm(Perm.FORECAST_READ)),
    db: Session = Depends(get_session),
) -> list[RateCardRow]:
    """Every category, every night, with the forecast beside the price."""
    return [RateCardRow(**row) for row in service.rate_card(db, UUID(principal.property_id), days=days)]


@router.post("/rates/apply", response_model=RateApplyResult)
def apply_rates(
    body: RateApplyRequest,
    principal: Principal = Depends(requires(Perm.RATES_APPROVE)),
    db: Session = Depends(get_session),
) -> RateApplyResult:
    """Set a price on specific dates and hand back exactly how to undo it.

    action-service calls this when a rate card is approved, and stores the returned
    `previous_rates` as the card's undo payload.
    """
    source = RateSource.ACTION_CARD if body.source_card_id else RateSource.MANUAL
    result = service.apply_rates(
        db,
        UUID(principal.property_id),
        room_category_id=body.room_category_id,
        dates=body.dates,
        rate=body.rate,
        source=source,
        source_card_id=body.source_card_id,
        changed_by=UUID(principal.id) if "-" in principal.id else None,
    )
    return RateApplyResult(**result)


@router.post("/rates/restore", response_model=dict)
def restore_rates(
    body: RateRestoreRequest,
    principal: Principal = Depends(requires(Perm.RATES_APPROVE)),
    db: Session = Depends(get_session),
) -> dict:
    """The undo half. Puts each date back, including back to having no override."""
    return service.restore_rates(
        db, UUID(principal.property_id), body.previous_rates, body.source_card_id
    )


@router.get("/rates/history", response_model=list[RateHistoryOut])
def rate_history(
    category_id: UUID | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    principal: Principal = Depends(requires_gm(Perm.FORECAST_READ)),
    db: Session = Depends(get_session),
) -> list[RateHistoryOut]:
    rows = service.rate_history(db, UUID(principal.property_id), category_id=category_id, limit=limit)
    return [RateHistoryOut.model_validate(r) for r in rows]


@router.get("/competitors", response_model=list[CompetitorRow])
def competitors(
    days: int = Query(default=14, ge=1, le=60),
    principal: Principal = Depends(requires_gm(Perm.FORECAST_READ)),
    db: Session = Depends(get_session),
) -> list[CompetitorRow]:
    rows = service.competitor_table(db, UUID(principal.property_id), days=days)
    return [CompetitorRow(**row) for row in rows]


@router.post("/cards/propose", response_model=dict)
def propose_cards(
    days: int = Query(default=14, ge=1, le=60),
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> dict:
    """Scan the next fortnight and raise rate cards where the price looks wrong.

    Runs on a schedule after the nightly forecast; exposed so the demo can trigger it.
    """
    if principal.role not in {"gm", "owner", "service"}:
        from vesper_common.errors import Forbidden
        raise Forbidden("Property Owner or General Manager access required")
    property_id = UUID(principal.property_id)
    if not service.list_forecast(db, property_id, days=days):
        service.generate_forecast(db, property_id, horizon=days)
    raised = service.propose_rate_cards(db, property_id, days=days)
    return {"cards_raised": len(raised)}


@router.post("/simulate", response_model=SimulateResult)
def simulate(
    body: SimulateRequest,
    principal: Principal = Depends(requires_gm(Perm.SIMULATOR_RUN)),
    db: Session = Depends(get_session),
) -> SimulateResult:
    """What-if on live data. The response carries its own assumptions."""
    return SimulateResult(
        **service.simulate(
            db,
            UUID(principal.property_id),
            rate_change_pct=body.rate_change_pct,
            staffing_change_pct=body.staffing_change_pct,
            promo_discount_pct=body.promo_discount_pct,
            days=body.days,
        )
    )
