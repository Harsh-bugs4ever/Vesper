from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from vesper_common.clock import utcnow
from vesper_common.db import get_session
from vesper_common.permissions import Perm, Role
from vesper_common.errors import Forbidden, NotFound
from vesper_common.security import Principal, current_user, requires, requires_gm

from . import dashboard as dashboard_builder
from . import overview
from . import service
from .models import ActionCard
from .schemas import (
    ActionStats,
    ApproveRequest,
    AuditCreate,
    AuditOut,
    CardCreate,
    CardDetail,
    CardOut,
    DismissRequest,
    OutcomeCreate,
    OutcomeOut,
    ReadinessOut,
    SnoozeRequest,
    GMOverviewOut,
    ManagerOverviewOut,
)

router = APIRouter(prefix="/cards", tags=["action-cards"])
dashboard_router = APIRouter(prefix="/dashboard", tags=["dashboard"])
learning_router = APIRouter(prefix="/learning", tags=["learning"])
audit_router = APIRouter(prefix="/audit", tags=["audit"])


@dashboard_router.get("/digital-twin")
def digital_twin(department_id: UUID,
                 rain_delta_mm: float = Query(default=0, ge=-50, le=150),
                 heat_delta_c: float = Query(default=0, ge=-15, le=15),
                 principal: Principal = Depends(requires_gm(Perm.DASHBOARD_READ)),
                 db: Session = Depends(get_session)) -> dict:
    """Read-only 14-day operational scenario for one department."""
    from .digital_twin import build_twin

    return build_twin(db, UUID(principal.property_id), department_id,
                      rain_delta_mm=rain_delta_mm, heat_delta_c=heat_delta_c)


@dashboard_router.get("/overview", response_model=GMOverviewOut)
def gm_overview(branch_id: UUID | None = None, start: date | None = None,
                end: date | None = None,
                principal: Principal = Depends(requires_gm(Perm.DASHBOARD_READ)),
                db: Session = Depends(get_session)) -> dict:
    from app.api.property.models import Property
    from app.api.staff.metrics import period

    branch = branch_id or UUID(principal.property_id)
    principal.require_property(branch)
    if db.get(Property, branch) is None:
        raise NotFound("Branch not found")
    begin, finish = period(start, end)
    return overview.gm_overview(db, branch, begin, finish)


@dashboard_router.get("/department", response_model=ManagerOverviewOut)
def manager_overview(department_id: UUID | None = None,
                     branch_id: UUID | None = None,
                     start: date | None = None, end: date | None = None,
                     principal: Principal = Depends(current_user),
                     db: Session = Depends(get_session)) -> dict:
    from app.api.property.models import Department
    from app.api.staff.metrics import period, scope

    if principal.role not in {Role.MANAGER, Role.GM}:
        raise Forbidden("Manager access required")
    branch, department = scope(db, principal, branch_id=branch_id,
                               department_id=department_id)
    if department is None:
        raise Forbidden("Select a department")
    row = db.get(Department, department)
    if row is None or row.property_id != branch:
        raise NotFound("Department not found")
    begin, finish = period(start, end)
    return overview.department_overview(db, branch, row, begin, finish)


def _detail(card: ActionCard) -> CardDetail:
    seconds_left = 0
    if card.undo_until:
        seconds_left = max(0, int((card.undo_until - utcnow()).total_seconds()))
    base_data = CardOut.model_validate(card).model_dump()

    # Calculate Risk % and Profit %
    conf = float(card.confidence) if card.confidence is not None else 0.75
    impact = float(card.impact_amount) if card.impact_amount is not None else 0.0
    profit_pct = round(min(98.0, max(15.0, conf * 82.0 + (12.0 if impact > 0 else 5.0))), 1)

    urgency_shift = 15.0 if str(card.urgency).lower() in ("critical", "urgency.critical") else (
        8.0 if str(card.urgency).lower() in ("high", "urgency.high") else -8.0
    )
    risk_pct = round(max(5.0, min(95.0, (1.0 - conf) * 100.0 + urgency_shift)), 1)

    # Core Autonomous Rule: Risk < 40% and Profit > 60%
    is_auto = risk_pct < 40.0 and profit_pct > 60.0

    recipient = "Front Desk and Operations Team"
    kind_str = str(card.kind).lower()
    if any(k in kind_str for k in ("retention", "recovery", "promo", "guest")):
        recipient = "Guest / Guest Experience Lead"
    elif any(k in kind_str for k in ("purchase", "chef", "food", "stock")):
        recipient = "Executive Chef & F&B Manager"
    elif any(k in kind_str for k in ("work_order", "audit", "turnover", "maintenance")):
        recipient = "Chief Engineer & Maintenance Crew"
    elif any(k in kind_str for k in ("roster", "staffing")):
        recipient = "Duty Manager & Shift Supervisor"
    elif "rate" in kind_str:
        recipient = "Revenue Manager & Reservations"

    return CardDetail(
        **base_data,
        can_undo=card.status == "executed" and seconds_left > 0,
        undo_seconds_left=seconds_left,
        risk_pct=risk_pct,
        profit_pct=profit_pct,
        is_auto_dispatched=is_auto,
        auto_recipient=recipient,
    )


@router.get("", response_model=list[CardDetail])
def queue(
    kind: str | None = None,
    engine: str | None = None,
    include_decided: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> list[CardDetail]:
    """The action queue, ranked. Cards you cannot approve are not shown."""
    cards = service.list_queue(
        db, principal, kind=kind, engine=engine, include_decided=include_decided, limit=limit
    )
    # Earlier demo runs persisted cards built from invented utilization, vision,
    # expiry and recovery evidence. Retain their audit records, but keep them
    # out of the decision queue until those sources are connected.
    unsupported = {"facility_demand_engine", "vision_turnover_engine",
                   "inventory_waste_rescue_engine"}
    cards = [card for card in cards if card.engine not in unsupported
             and not (card.engine == "churn_recovery_engine"
                      and (card.dedupe_key or "").startswith("guest_recovery:simulated:"))]
    return [_detail(c) for c in cards]


@router.post("", response_model=CardOut, status_code=status.HTTP_201_CREATED)
def create_card(
    body: CardCreate,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> CardOut:
    """Engines post here. Re-posting the same dedupe_key refreshes rather than duplicates."""
    if principal.role not in {Role.GM, "service"}:
        raise Forbidden("Only General Managers and internal engines may create cards")
    if body.department_id is not None:
        principal.require_department_record(db, body.department_id)
    payload = body.model_copy(
        update={"drivers": [d.model_dump() for d in body.drivers], "kind": body.kind.value,
                "urgency": body.urgency.value}
    )
    card = service.create_card(db, UUID(principal.property_id), payload)
    return CardOut.model_validate(card)


@router.get("/stats", response_model=ActionStats)
def stats(
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> ActionStats:
    departments = None if principal.role in {Role.GM, "service"} else principal.department_ids
    return ActionStats(**service.stats_summary(db, UUID(principal.property_id), department_ids=departments))


@router.post("/ai-automation/run-all")
def trigger_all_automations(
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> dict:
    """Runs all 4 AI automation engines and returns created/updated cards."""
    from . import ai_automation
    return ai_automation.run_all_ai_automations(db, UUID(principal.property_id))


@router.post("/ai-automation/facility-promo")
def trigger_facility_promo(
    facility_name: str = Query(default="Badminton Pavilion"),
    discount_pct: int = Query(default=20, ge=5, le=50),
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> dict:
    from . import ai_automation
    card = ai_automation.run_facility_utilization_check(
        db, UUID(principal.property_id), facility_name=facility_name, discount_pct=discount_pct
    )
    return {"card": _detail(card) if card else None}


@router.post("/ai-automation/guest-recovery")
def trigger_guest_recovery(
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> dict:
    from . import ai_automation
    cards = ai_automation.run_guest_recovery_check(db, UUID(principal.property_id))
    return {"cards": [_detail(c) for c in cards]}


@router.post("/ai-automation/vision-audit")
def trigger_vision_audit(
    room_id: UUID | None = None,
    photo_url: str = Query(default="/landing/login-retreat.png"),
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> dict:
    from . import ai_automation
    return ai_automation.run_vision_room_audit(
        db, UUID(principal.property_id), room_id=room_id, photo_url=photo_url
    )


@router.post("/ai-automation/kitchen-waste")
def trigger_kitchen_waste(
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> dict:
    from . import ai_automation
    card = ai_automation.run_kitchen_waste_rescue(db, UUID(principal.property_id))
    return {"card": _detail(card) if card else None}


@router.get("/{card_id}", response_model=CardDetail)
def get_card(
    card_id: UUID,
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> CardDetail:
    card = service.get_card(db, UUID(principal.property_id), card_id)
    principal.require_object(card)
    return _detail(card)


@router.post("/{card_id}/claim", response_model=CardDetail)
def claim(
    card_id: UUID,
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> CardDetail:
    """Hold the card while you read it. Released automatically after ten minutes."""
    return _detail(service.claim(db, principal, card_id))


@router.post("/{card_id}/release", response_model=CardDetail)
def release(
    card_id: UUID,
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> CardDetail:
    return _detail(service.release(db, principal, card_id))


@router.post("/{card_id}/approve", response_model=CardDetail)
def approve(
    card_id: UUID,
    body: ApproveRequest,
    principal: Principal = Depends(requires(Perm.CARDS_APPROVE)),
    db: Session = Depends(get_session),
) -> CardDetail:
    """Approve and execute. The per-card permission is checked on top of cards:approve."""
    return _detail(service.approve(db, principal, card_id, body.adjustments))


@router.post("/{card_id}/undo", response_model=CardDetail)
def undo(
    card_id: UUID,
    principal: Principal = Depends(requires(Perm.CARDS_APPROVE)),
    db: Session = Depends(get_session),
) -> CardDetail:
    """Safe revert, while the countdown on the toast is still running."""
    return _detail(service.undo_card(db, principal, card_id))


@router.post("/{card_id}/snooze", response_model=CardDetail)
def snooze(
    card_id: UUID,
    body: SnoozeRequest,
    principal: Principal = Depends(requires(Perm.CARDS_READ)),
    db: Session = Depends(get_session),
) -> CardDetail:
    return _detail(service.snooze(db, principal, card_id, body.minutes))


@router.post("/{card_id}/dismiss", response_model=CardDetail)
def dismiss(
    card_id: UUID,
    body: DismissRequest,
    principal: Principal = Depends(requires(Perm.CARDS_DISMISS)),
    db: Session = Depends(get_session),
) -> CardDetail:
    """No, and why. Only 'not accurate' counts against the engine's confidence."""
    return _detail(service.dismiss(db, principal, card_id, body.reason.value, body.note))


@router.post("/{card_id}/outcome", response_model=OutcomeOut, status_code=status.HTTP_201_CREATED)
def score_outcome(
    card_id: UUID,
    body: OutcomeCreate,
    principal: Principal = Depends(requires_gm(Perm.LEARNING_READ)),
    db: Session = Depends(get_session),
) -> OutcomeOut:
    """Close the loop: what actually happened, against what was predicted."""
    outcome = service.score_outcome(
        db, UUID(principal.property_id), card_id, body.actual_amount, body.notes
    )
    return OutcomeOut.model_validate(outcome)


@learning_router.get("", response_model=list[dict])
def learning(
    principal: Principal = Depends(requires_gm(Perm.LEARNING_READ)),
    db: Session = Depends(get_session),
) -> list[dict]:
    """Per-engine accuracy, approval rate and earned confidence."""
    return service.learning_report(db, UUID(principal.property_id))


@learning_router.get("/readiness", response_model=ReadinessOut)
def readiness(
    principal: Principal = Depends(requires_gm(Perm.LEARNING_READ)),
    db: Session = Depends(get_session),
) -> ReadinessOut:
    """Cold-start banner data: which engines have enough history to be believed."""
    return ReadinessOut(**service.readiness(db, UUID(principal.property_id)))


@audit_router.get("", response_model=list[AuditOut])
def list_audit(
    entity_type: str | None = None,
    actor_id: UUID | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    principal: Principal = Depends(requires(Perm.AUDIT_READ)),
    db: Session = Depends(get_session),
) -> list[AuditOut]:
    rows = service.list_audit(
        db, UUID(principal.property_id), entity_type=entity_type, actor_id=actor_id, limit=limit
    )
    return [AuditOut.model_validate(r) for r in rows]


@audit_router.post("", response_model=AuditOut, status_code=status.HTTP_201_CREATED)
def record_audit(
    body: AuditCreate,
    principal: Principal = Depends(current_user),
    db: Session = Depends(get_session),
) -> AuditOut:
    """Other services log their own decisions here so there is one trail, not thirteen."""
    if principal.role != "service":
        raise Forbidden("Service access required")
    entry = service.record_audit(
        db,
        UUID(principal.property_id),
        actor_id=UUID(principal.id) if "-" in principal.id else None,
        actor_role=principal.role,
        action=body.action,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        before=body.before,
        after=body.after,
        note=body.note,
    )
    return AuditOut.model_validate(entry)


@dashboard_router.get("", response_model=dict)
def dashboard(
    request: Request,
    live_feed: int = Query(default=15, ge=0, le=50),
    principal: Principal = Depends(requires_gm(Perm.DASHBOARD_READ)),
    db: Session = Depends(get_session),
) -> dict:
    """Every tile on the General Manager dashboard in one call.

    The caller's own token is forwarded to each service, so the dashboard shows exactly
    what this person is allowed to see rather than widening to a service principal.
    Tiles that could not be loaded come back null and are named in `unavailable`.
    """
    token = request.headers.get("authorization", "").removeprefix("Bearer ").strip() or None
    return dashboard_builder.build(
        db, UUID(principal.property_id), token=token, live_feed=live_feed
    )


@router.post("/auto-execute-qualified")
def auto_execute_qualified_cards(
    principal: Principal = Depends(requires(Perm.CARDS_APPROVE)),
    db: Session = Depends(get_session),
) -> dict:
    """Finds all actionable cards where risk < 40% and profit > 60% and auto-executes them."""
    cards = service.list_queue(
        db, principal, include_decided=False, limit=100
    )
    executed = []
    for card in cards:
        if card.status in {"executed", "dismissed", "expired"}:
            continue
        conf = float(card.confidence) if card.confidence is not None else 0.75
        impact = float(card.impact_amount) if card.impact_amount is not None else 0.0
        profit_pct = round(min(98.0, max(15.0, conf * 82.0 + (12.0 if impact > 0 else 5.0))), 1)
        urgency_shift = 15.0 if str(card.urgency).lower() in ("critical", "urgency.critical") else (
            8.0 if str(card.urgency).lower() in ("high", "urgency.high") else -8.0
        )
        risk_pct = round(max(5.0, min(95.0, (1.0 - conf) * 100.0 + urgency_shift)), 1)
        if risk_pct < 40.0 and profit_pct > 60.0:
            try:
                service.approve(db, principal, card.id, adjustments={"auto_executed_by_ai": True, "risk_pct": risk_pct, "profit_pct": profit_pct})
                executed.append(str(card.id))
            except Exception:
                pass
    return {"executed_count": len(executed), "executed_card_ids": executed}
