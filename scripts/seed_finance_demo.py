"""Preview or add missing monthly department budgets for the synthetic resort.

This is an additive overlay for an existing demo database; it never resets schemas
or changes allocations that already exist.

  python scripts/seed_finance_demo.py --list-properties
  python scripts/seed_finance_demo.py --property-id UUID
  python scripts/seed_finance_demo.py --property-id UUID --apply
"""
from __future__ import annotations

import argparse
import sys
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from uuid import UUID
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "packages" / "py-common"))

from sqlalchemy import select  # noqa: E402
from vesper_common.clock import utcnow  # noqa: E402
from vesper_common.db import import_all_models, session_scope  # noqa: E402


ALLOCATIONS = {
    "front_office": Decimal("1800000"),
    "housekeeping": Decimal("2400000"),
    "fnb": Decimal("5200000"),
    "maintenance": Decimal("3100000"),
    "store": Decimal("1600000"),
}


def seed_finance_demo(db, property_id: UUID, *, apply: bool = False) -> dict[str, object]:
    from app.api.identity.models import User
    from app.api.inventory.models import DepartmentBudget
    from app.api.property.models import Department, Property

    resort = db.get(Property, property_id)
    if resort is None:
        raise ValueError("Property not found")
    demo_owner = db.scalar(select(User.id).where(
        User.property_id == property_id, User.email == "owner@vesper.demo"
    ))
    if resort.name != "JW Marriott Mumbai, Juhu" or demo_owner is None:
        raise ValueError("Finance examples are restricted to the synthetic JW Marriott demo resort")

    today = utcnow().astimezone(ZoneInfo(resort.timezone)).date()
    period_start = today.replace(day=1)
    next_month = (period_start + timedelta(days=32)).replace(day=1)
    period_end = next_month - timedelta(days=1)
    departments = {row.key: row for row in db.scalars(select(Department).where(Department.property_id == property_id))}
    missing_keys = set(ALLOCATIONS) - departments.keys()
    if missing_keys:
        raise ValueError(f"Demo property is missing departments: {', '.join(sorted(missing_keys))}")

    created: list[str] = []
    existing: list[str] = []
    for key, allocation in ALLOCATIONS.items():
        row = db.scalar(select(DepartmentBudget).where(
            DepartmentBudget.property_id == property_id,
            DepartmentBudget.department_id == departments[key].id,
            DepartmentBudget.period_start == period_start,
            DepartmentBudget.period_end == period_end,
            DepartmentBudget.currency == resort.currency,
        ))
        if row is not None:
            existing.append(key)
            continue
        created.append(key)
        if apply:
            db.add(DepartmentBudget(
                property_id=property_id,
                department_id=departments[key].id,
                period_start=period_start,
                period_end=period_end,
                currency=resort.currency,
                allocated=allocation,
            ))
    if apply:
        db.commit()
    return {
        "property": resort.name,
        "period": f"{period_start} through {period_end}",
        "created" if apply else "would_create": created,
        "already_present": existing,
        "total_new_allocation": str(sum((ALLOCATIONS[key] for key in created), Decimal("0"))),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Preview or add demo finance budgets without resetting data")
    parser.add_argument("--list-properties", action="store_true")
    parser.add_argument("--property-id", type=UUID)
    parser.add_argument("--apply", action="store_true", help="Write only missing monthly budgets")
    args = parser.parse_args()
    import_all_models(str(ROOT / "app" / "api"))
    from app.api.property.models import Property

    db = session_scope()
    try:
        if args.list_properties:
            for row in db.scalars(select(Property).order_by(Property.name)):
                print(f"{row.id}  {row.name}")
            return 0
        if args.property_id is None:
            parser.error("--property-id is required unless --list-properties is used")
        result = seed_finance_demo(db, args.property_id, apply=args.apply)
        print("Finance demo seed applied:" if args.apply else "Finance demo seed preview (no writes):")
        for key, value in result.items():
            print(f"  {key}: {value}")
        return 0
    except ValueError as error:
        parser.error(str(error))
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
