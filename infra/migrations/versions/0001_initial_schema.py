"""Initial schema: the twelve bounded contexts and their tables.

Up to now the only way to build the database was `infra/bootstrap.py`, which runs
`create_all`. That is fine for a laptop and useless for a deployment — it cannot alter an
existing database, so the first schema change in production would have had nowhere to go.
This is the baseline every later migration builds on.

The tables themselves are created from the SQLAlchemy metadata rather than being spelled
out again here. The twelve contexts own 44 tables between them; transcribing all of them
into this file by hand would give two definitions of the schema that are free to drift,
and the models are the ones the code actually reads.

The metadata is read from app/api/<name>/models.py. That path moved when the services
were folded into one process; the models, and so the schema this produces, did not.

Revision ID: 0001
"""
from __future__ import annotations

import sys
from pathlib import Path

from alembic import op
from sqlalchemy import MetaData, String

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py-common"))

from vesper_common.db import SCHEMAS, Base, import_all_models  # noqa: E402

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def _metadata():
    import_all_models(str(REPO_ROOT / "app" / "api"))
    # This revision is a historical baseline. Clone today's model metadata, then
    # remove objects owned by later revisions so fresh installs and upgrades use
    # the same path. Never mutate the application's live ORM metadata.
    later_tables = {
        "user_assignments", "guest_staff_reviews", "staff_performance_summaries",
        "room_images", "resort_amenities", "department_budgets",
        "inventory_requests", "inventory_request_lines", "inventory_request_audit",
        "purchase_operations",
    }
    later_columns = {
        "property.properties": {"address"},
        "guest_intel.stay_review_summaries": {
            "final_score", "engagement_bonus", "guest_sentiment", "possible_retaliation",
        },
        "guest.issue_reports": {
            "reporter_department_id", "responsible_manager_id", "evidence", "work_order_id",
        },
        "maintenance.work_orders": {"room_id", "source_issue_id"},
        "inventory.purchase_orders": {
            "department_id", "budget_id", "request_line_id", "currency",
            "received_quantity", "returned_quantity", "reorder_key",
        },
        "inventory.stock_items": {
            "safety_stock_days", "target_stock_days", "average_daily_usage_14d",
            "reorder_threshold", "last_threshold_calculated_at",
        },
        "inventory.stock_movements": {"department_id"},
    }
    later_indexes = {
        "uq_frontdesk_one_active_stay_per_room", "uq_frontdesk_one_active_stay_per_booking",
        "uq_frontdesk_stays_open_room", "uq_frontdesk_stays_booking",
        "ix_stock_movements_reorder_history", "ix_purchase_orders_incoming_item_status",
    }
    baseline = MetaData(naming_convention=Base.metadata.naming_convention)
    for table in Base.metadata.sorted_tables:
        if table.name not in later_tables:
            table.to_metadata(baseline)
    for key, table in baseline.tables.items():
        removed = later_columns.get(key, set())
        for index in list(table.indexes):
            if index.name in later_indexes or any(column.name in removed for column in index.columns):
                table.indexes.remove(index)
        for constraint in list(table.constraints):
            if any(column.name in removed for column in constraint.columns):
                table.constraints.remove(constraint)
            if key == "maintenance.work_orders" and constraint.name == "ck_work_order_location":
                table.constraints.remove(constraint)
        for name in removed:
            column = table.c[name]
            for foreign_key in list(column.foreign_keys):
                table.foreign_keys.discard(foreign_key)
            table._columns.remove(column)
    baseline.tables["maintenance.work_orders"].c.asset_id.nullable = False
    baseline.tables["inventory.purchase_orders"].c.status.type = String(16)
    return baseline


def upgrade() -> None:
    bind = op.get_bind()
    for schema in SCHEMAS:
        op.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
    # Keep the baseline stable as later model tables are added. Their migrations own
    # creation; otherwise a fresh upgrade attempts to create them twice.
    baseline = _metadata()
    baseline.create_all(bind=bind)


def downgrade() -> None:
    # Dropping the schemas takes the tables, indexes and constraints with them, which is
    # both simpler and more reliable than dropping 44 tables in dependency order.
    for schema in SCHEMAS:
        op.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
