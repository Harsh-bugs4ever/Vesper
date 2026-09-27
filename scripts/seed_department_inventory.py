"""Populate and assign demo stock to its operating departments."""
from __future__ import annotations

import argparse
import sys
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from uuid import UUID

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py-common"))

from sqlalchemy import select

from vesper_common.clock import local_today
from vesper_common.db import import_all_models, session_scope

CATEGORY_DEPARTMENT = {
    "food": "fnb",
    "beverage": "fnb",
    "linen": "housekeeping",
    "toiletries": "housekeeping",
    "cleaning": "housekeeping",
    "spare_parts": "maintenance",
}

CENTRAL_STORE_SKUS = {"FD-BREAD", "FD-EGGS", "FD-RICE", "FD-CHICKEN"}
SKU_DEPARTMENT = {
    "FO-WELCOME": "front_office",
    "FO-KEY-SLEEVE": "front_office",
    "SEC-TORCH": "security",
    "SEC-BATTERY": "security",
    "ST-LABEL": "store",
    "ST-GLOVES": "store",
    "FB-NAPKINS": "fnb",
    "FB-GLASSWARE": "fnb",
}

DEPARTMENT_ITEMS = (
    ("FO-WELCOME", "Guest Welcome Amenity Pouch", "toiletries", "piece",
     180, 80, 160, 65, "Resort Essentials", 4, "front_office"),
    ("FO-KEY-SLEEVE", "Guest Key Card Sleeve", "toiletries", "piece",
     240, 100, 200, 12, "Resort Essentials", 4, "front_office"),
    ("SEC-TORCH", "Rechargeable Safety Torch", "spare_parts", "piece",
     18, 8, 16, 780, "SafeStay Supplies", 6, "security"),
    ("SEC-BATTERY", "Radio Battery Pack", "spare_parts", "piece",
     24, 10, 20, 420, "SafeStay Supplies", 5, "security"),
    ("ST-LABEL", "Stock Shelf Labels", "cleaning", "roll",
     42, 15, 30, 85, "Store & Supply Co", 3, "store"),
    ("ST-GLOVES", "Reusable Stock Handling Gloves", "cleaning", "pair",
     36, 12, 24, 110, "Store & Supply Co", 3, "store"),
    ("FB-NAPKINS", "Restaurant Service Napkins", "linen", "piece",
     520, 200, 400, 28, "Linen Mills", 5, "fnb"),
    ("FB-GLASSWARE", "Beverage Glassware", "beds", "piece",
     96, 36, 72, 160, "Dining Supply Co", 7, "fnb"),
)


def seed_department_inventory(db, property_id: UUID) -> dict[str, int]:
    """Assign existing demo stock and add missing departmental supplies idempotently."""
    import vesper_models.identity as identity
    import vesper_models.inventory as inventory
    import vesper_models.property as prop

    resort = db.get(prop.Property, property_id)
    if resort is None or resort.name != "JW Marriott Mumbai, Juhu":
        raise ValueError("Department inventory seeding is limited to the synthetic demo resort")

    departments = {row.key: row for row in db.scalars(select(prop.Department).where(
        prop.Department.property_id == property_id))}
    required = {item[-1] for item in DEPARTMENT_ITEMS}
    required.update(CATEGORY_DEPARTMENT.values())
    required.add("store")
    missing = required - departments.keys()
    if missing:
        raise ValueError(f"Demo departments are missing: {sorted(missing)}")

    counts = {"items_reassigned": 0, "department_items_added": 0,
              "staff_stock_permissions_added": 0, "obsolete_pool_permissions_removed": 0}
    role = db.scalar(select(identity.Role).where(
        identity.Role.property_id == property_id, identity.Role.key == "staff"))
    if role is None:
        raise ValueError("Demo staff role is missing")
    staff = db.scalars(select(identity.User).where(
        identity.User.property_id == property_id,
        identity.User.role_id == role.id,
        identity.User.department_id.is_not(None),
    ))
    for user in staff:
        grants = set(user.extra_permissions or [])
        if "tasks:pool_read" in grants:
            grants.remove("tasks:pool_read")
            counts["obsolete_pool_permissions_removed"] += 1
        if "stock:read" not in grants:
            grants.add("stock:read")
            counts["staff_stock_permissions_added"] += 1
        user.extra_permissions = sorted(grants)

    roles = db.scalars(select(identity.Role).where(
        identity.Role.property_id == property_id))
    for role in roles:
        if "tasks:pool_read" in (role.permissions or []):
            role.permissions = [permission for permission in role.permissions
                                if permission != "tasks:pool_read"]
            counts["obsolete_pool_permissions_removed"] += 1

    items = list(db.scalars(select(inventory.StockItem).where(
        inventory.StockItem.property_id == property_id)))
    for item in items:
        target_key = SKU_DEPARTMENT.get(
            item.sku,
            "store" if item.sku in CENTRAL_STORE_SKUS
            else CATEGORY_DEPARTMENT.get(item.category),
        )
        if target_key is not None and item.department_id != departments[target_key].id:
            item.department_id = departments[target_key].id
            counts["items_reassigned"] += 1

    by_sku = {item.sku: item for item in items}
    today = local_today()
    for (sku, name, category, unit, quantity, minimum, reorder, unit_cost,
         supplier, lead_time_days, department_key) in DEPARTMENT_ITEMS:
        if sku in by_sku:
            continue
        db.add(inventory.StockItem(
            property_id=property_id,
            department_id=departments[department_key].id,
            sku=sku,
            name=name,
            category=category,
            unit=unit,
            quantity=Decimal(quantity),
            minimum_quantity=Decimal(minimum),
            reorder_quantity=Decimal(reorder),
            unit_cost=Decimal(unit_cost),
            supplier=supplier,
            lead_time_days=lead_time_days,
            expires_on=today + timedelta(days=60) if category in {"food", "beverage"} else None,
        ))
        counts["department_items_added"] += 1

    db.flush()
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed department-wise demo inventory")
    parser.add_argument("--property-id", type=UUID,
                        help="Demo property UUID, needed only if multiple demo properties exist")
    args = parser.parse_args()

    import_all_models(str(REPO_ROOT / "app" / "api"))
    import vesper_models.property as prop

    with session_scope() as db:
        property_id = args.property_id
        if property_id is None:
            matches = list(db.scalars(select(prop.Property.id).where(
                prop.Property.name == "JW Marriott Mumbai, Juhu")))
            if len(matches) != 1:
                parser.error("Expected one demo resort. Run python scripts/seed.py first "
                             "or pass --property-id to choose one.")
            property_id = matches[0]
        try:
            counts = seed_department_inventory(db, property_id)
        except ValueError as exc:
            parser.error(str(exc))
        db.commit()

    print(f"Department inventory saved for property {property_id}:")
    for department, count in counts.items():
        print(f"  {department:<24} {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
