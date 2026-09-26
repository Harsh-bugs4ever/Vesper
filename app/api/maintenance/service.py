"""Scoring asset health, raising work-order cards and running the work itself."""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from vesper_common.clients import action, guest, property_client, revenue
from vesper_common.clock import local_today, utcnow
from vesper_common.errors import Conflict, NotFound
from vesper_common.events import Event, bus
from vesper_common.permissions import Perm

from .engines import anomaly
from .engines.anomaly import Reading
from .models import AssetHealth, WorkOrder, WorkOrderKind, WorkOrderStatus

log = logging.getLogger(__name__)

# How much history to score an asset on.
WINDOW_HOURS = 24 * 14
# Raise a card above this. Below it, the risk gauge shows amber and nobody is paged.
CARD_RISK_THRESHOLD = 0.55

# What a failure of each asset type costs in lost revenue and recovery, used as the
# card's impact figure. Demo-grade estimates a GM can override in settings.
DOWNTIME_COST = {
    "chiller": Decimal("180000"),
    "lift": Decimal("120000"),
    "boiler": Decimal("90000"),
    "pump": Decimal("45000"),
    "kitchen": Decimal("60000"),
    "hvac": Decimal("75000"),
    "generator": Decimal("150000"),
}
DEFAULT_DOWNTIME_COST = Decimal("40000")


def assess_asset(
    db: Session,
    property_id: UUID,
    asset: dict,
    *,
    metric: str | None = None,
    issue_counts: dict[str, int] | None = None,
) -> AssetHealth:
    """Score one asset from its recent sensor window.

    `issue_counts` is passed in by the sweep so the issue list is fetched once for the
    whole property rather than once per asset — that was twelve identical HTTP round
    trips, enough to push the endpoint past its client timeout.
    """
    asset_id = UUID(asset["id"])
    raw = (
        property_client.get(
            f"/assets/{asset_id}/readings",
            property_id=property_id,
            params={"hours": WINDOW_HOURS, **({"metric": metric} if metric else {})},
        )
        or []
    )
    readings = [
        Reading(recorded_at=datetime.fromisoformat(r["recorded_at"]), value=float(r["value"]))
        for r in raw
    ]

    anomalies, method = anomaly.detect(readings)
    assessment = anomaly.assess_risk(
        readings=readings,
        anomalies=anomalies,
        method=method,
        last_serviced_on=date.fromisoformat(asset["last_serviced_on"]) if asset.get("last_serviced_on") else None,
        service_interval_days=int(asset.get("service_interval_days") or 180),
        installed_on=date.fromisoformat(asset["installed_on"]) if asset.get("installed_on") else None,
        criticality=asset.get("criticality", "medium"),
        issue_reports_90d=(
            issue_counts.get(str(asset_id), 0)
            if issue_counts is not None
            else _issue_counts(property_id).get(str(asset_id), 0)
        ),
        today=local_today(),
    )

    health = db.scalars(
        select(AssetHealth).where(
            AssetHealth.property_id == property_id, AssetHealth.asset_id == asset_id
        )
    ).first()
    if health is None:
        health = AssetHealth(property_id=property_id, asset_id=asset_id)
        db.add(health)

    health.risk_score = assessment.risk_score
    health.confidence = assessment.confidence
    health.drivers = assessment.drivers
    health.method = assessment.method
    health.anomaly_count = assessment.anomaly_count
    health.trend_per_day = assessment.trend_per_day
    health.readings_considered = len(readings)
    health.anomalies = [
        {
            "recorded_at": a.recorded_at.isoformat(),
            "value": a.value,
            "score": a.score,
            "reason": a.reason,
        }
        for a in anomalies[-50:]  # the chart only draws the recent ones
    ]
    health.assessed_at = utcnow()
    db.commit()
    db.refresh(health)
    return health


def assess_all(db: Session, property_id: UUID) -> list[AssetHealth]:
    """Nightly sweep across every active asset, raising cards where warranted."""
    assets = property_client.get("/assets", property_id=property_id) or []
    # One fetch for the whole sweep, not one per asset.
    issue_counts = _issue_counts(property_id)
    results: list[AssetHealth] = []
    for asset in assets:
        if not asset.get("is_active", True):
            continue
        try:
            health = assess_asset(db, property_id, asset, issue_counts=issue_counts)
        except Exception:
            log.exception("could not assess asset %s", asset.get("code"))
            continue
        results.append(health)
        if health.risk_score >= CARD_RISK_THRESHOLD:
            raise_work_order_card(db, property_id, asset, health)
    return results


def raise_work_order_card(db: Session, property_id: UUID, asset: dict, health: AssetHealth) -> dict | None:
    """Ask for a repair on the quietest night we can find.

    Published as an event rather than posted directly so action-service owns card
    shaping in one place — see its events.py.
    """
    forecast = revenue.get("/revenue/forecast", property_id=property_id, params={"days": 14}) or []
    window = anomaly.suggest_service_window(
        [
            {"stay_date": f["stay_date"], "predicted_occupancy": f["predicted_occupancy"]}
            for f in forecast
        ]
    )
    cost = DOWNTIME_COST.get(asset.get("asset_type", ""), DEFAULT_DOWNTIME_COST)

    summary = (
        f"{asset['name']} is showing a {health.risk_score:.0%} failure risk. "
        + (f"{health.anomaly_count} unusual readings in the last fortnight. " if health.anomaly_count else "")
        + (window["reason"] + "." if window else "No quiet night found in the next fortnight.")
    )

    bus.publish(
        Event.ANOMALY_DETECTED,
        {
            "asset_id": str(asset["id"]),
            "asset_name": asset["name"],
            "asset_type": asset.get("asset_type"),
            "department_id": asset.get("department_id"),
            "risk_score": health.risk_score,
            "confidence": health.confidence,
            "drivers": health.drivers,
            "summary": summary,
            "suggested_window": window,
            "estimated_downtime_cost": float(cost),
        },
        property_id=str(property_id),
    )
    return window


def list_health(db: Session, property_id: UUID, *, min_risk: float = 0.0) -> list[AssetHealth]:
    query = (
        select(AssetHealth)
        .where(AssetHealth.property_id == property_id, AssetHealth.risk_score >= min_risk)
        .order_by(AssetHealth.risk_score.desc())
    )
    return list(db.scalars(query))


def get_health(db: Session, property_id: UUID, asset_id: UUID) -> AssetHealth:
    query = select(AssetHealth).where(
        AssetHealth.property_id == property_id, AssetHealth.asset_id == asset_id
    )
    health = db.scalars(query).first()
    if health is None:
        raise NotFound("This asset has not been assessed yet")
    return health


# --- work orders ------------------------------------------------------------------


def create_work_order(db: Session, property_id: UUID, data, *, source_card_id: UUID | None = None) -> WorkOrder:
    order = WorkOrder(
        property_id=property_id,
        asset_id=data.asset_id,
        room_id=getattr(data, "room_id", None),
        source_issue_id=getattr(data, "source_issue_id", None),
        department_id=data.department_id,
        source_card_id=source_card_id,
        title=data.title,
        description=data.description,
        kind=data.kind.value if hasattr(data.kind, "value") else data.kind,
        priority=data.priority,
        scheduled_for=data.scheduled_for,
        scheduling_rationale=getattr(data, "scheduling_rationale", {}) or {},
        estimated_cost=data.estimated_cost,
        status=WorkOrderStatus.SCHEDULED if data.scheduled_for else WorkOrderStatus.OPEN,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def list_work_orders(db: Session, property_id: UUID, *, status: str | None = None, asset_id: UUID | None = None) -> list[WorkOrder]:
    query = select(WorkOrder).where(WorkOrder.property_id == property_id)
    if status:
        query = query.where(WorkOrder.status == status)
    if asset_id:
        query = query.where(WorkOrder.asset_id == asset_id)
    return list(db.scalars(query.order_by(WorkOrder.scheduled_for.nulls_last(), WorkOrder.created_at.desc())))


def get_work_order(db: Session, property_id: UUID, order_id: UUID) -> WorkOrder:
    query = select(WorkOrder).where(
        WorkOrder.id == order_id, WorkOrder.property_id == property_id
    )
    order = db.scalars(query).first()
    if order is None:
        raise NotFound("Work order not found")
    return order


def complete_work_order(db: Session, property_id: UUID, order_id: UUID, *, actual_cost: Decimal | None, notes: str | None) -> WorkOrder:
    from app.api.guest.models import IssueReport, IssueStatus
    from app.api.staff.models import Task, TaskStatus

    order = db.scalars(select(WorkOrder).where(
        WorkOrder.id == order_id, WorkOrder.property_id == property_id
    ).with_for_update()).first()
    if order is None:
        raise NotFound("Work order not found")
    if order.status in {WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED}:
        raise Conflict("That work order is already closed")

    report = None
    if order.source_issue_id:
        report = db.scalars(select(IssueReport).where(
            IssueReport.id == order.source_issue_id,
            IssueReport.property_id == property_id,
        ).with_for_update()).first()
        if report is None or report.status != IssueStatus.SCHEDULED:
            raise Conflict("The linked report must be approved before completion")

    order.status = WorkOrderStatus.COMPLETED
    order.completed_at = utcnow()
    order.actual_cost = actual_cost
    order.notes = notes
    if order.source_issue_id:
        report.status = IssueStatus.RESOLVED
        report.resolved_at = order.completed_at
        if order.task_id:
            task = db.scalars(select(Task).where(
                Task.id == order.task_id, Task.property_id == property_id
            ).with_for_update()).first()
            if task and task.status not in {TaskStatus.DONE, TaskStatus.CANCELLED}:
                task.status = TaskStatus.DONE
                task.completed_at = order.completed_at
    db.commit()
    db.refresh(order)

    # A serviced asset should stop looking risky on the next sweep; tell property
    # so the service clock resets.
    if order.asset_id:
        property_client.post(
            f"/assets/{order.asset_id}/serviced",
            property_id=property_id,
            json={"serviced_on": local_today().isoformat()},
        )
    return order


def cancel_work_order(db: Session, property_id: UUID, order_id: UUID) -> WorkOrder:
    order = get_work_order(db, property_id, order_id)
    if order.status == WorkOrderStatus.COMPLETED:
        raise Conflict("That work order is already complete")
    order.status = WorkOrderStatus.CANCELLED
    db.commit()
    db.refresh(order)
    return order


def summary(db: Session, property_id: UUID, *, department_ids: set[str] | None = None) -> dict:
    """Maintenance tiles for the owner dashboard."""
    health = list_health(db, property_id)
    if department_ids is not None:
        from app.api.property.models import Asset
        allowed_assets = set(db.scalars(select(Asset.id).where(Asset.property_id == property_id, Asset.department_id.in_([UUID(value) for value in department_ids]))))
        health = [row for row in health if row.asset_id in allowed_assets]
    at_risk = [h for h in health if h.risk_score >= CARD_RISK_THRESHOLD]
    open_orders = list_work_orders(db, property_id, status=WorkOrderStatus.OPEN)
    scheduled = list_work_orders(db, property_id, status=WorkOrderStatus.SCHEDULED)
    if department_ids is not None:
        open_orders = [row for row in open_orders if str(row.department_id) in department_ids]
        scheduled = [row for row in scheduled if str(row.department_id) in department_ids]
    return {
        "assets_assessed": len(health),
        "assets_at_risk": len(at_risk),
        "open_work_orders": len(open_orders),
        "scheduled_work_orders": len(scheduled),
        "highest_risk": round(max((h.risk_score for h in health), default=0.0), 4),
    }


def _issue_counts(property_id: UUID) -> dict[str, int]:
    """How often each asset has been reported by staff lately, keyed by asset id.

    Duplicate reports count individually: three housekeepers flagging the same dead AC is
    stronger evidence than one, which is exactly what `duplicate_count` records.
    """
    issues = guest.get("/issues", property_id=property_id) or []
    cutoff = local_today() - timedelta(days=90)
    counts: dict[str, int] = {}
    for issue in issues:
        asset_id = issue.get("asset_id")
        if not asset_id:
            continue
        created = issue.get("created_at")
        if created and datetime.fromisoformat(created).date() >= cutoff:
            counts[asset_id] = counts.get(asset_id, 0) + issue.get("duplicate_count", 1)
    return counts
