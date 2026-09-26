"""Repair databases stamped past staff operational schema changes.

Revision ID: 0009
Revises: 0008

Some existing installations reached 0007 through the property-content branch before
the staff operational migration was merged. Check the physical schema before each
operation so the migration is harmless on installations that already have the changes.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def _columns(table: str, schema: str) -> dict[str, dict]:
    return {item["name"]: item for item in sa.inspect(op.get_bind()).get_columns(table, schema=schema)}


def _indexes(table: str, schema: str) -> set[str]:
    return {item["name"] for item in sa.inspect(op.get_bind()).get_indexes(table, schema=schema)}


def upgrade() -> None:
    issue_columns = _columns("issue_reports", "guest")
    for name in ("reporter_department_id", "responsible_manager_id", "work_order_id"):
        if name not in issue_columns:
            op.add_column("issue_reports", sa.Column(name, sa.Uuid(), nullable=True), schema="guest")
    if "evidence" not in issue_columns:
        op.add_column("issue_reports", sa.Column("evidence", JSONB(), nullable=False,
            server_default=sa.text("'[]'::jsonb")), schema="guest")
    if "ix_guest_issue_reports_work_order_id" not in _indexes("issue_reports", "guest"):
        op.create_index("ix_guest_issue_reports_work_order_id", "issue_reports",
                        ["work_order_id"], schema="guest")

    order_columns = _columns("work_orders", "maintenance")
    if not order_columns["asset_id"]["nullable"]:
        op.alter_column("work_orders", "asset_id", nullable=True, schema="maintenance")
    for name in ("room_id", "source_issue_id"):
        if name not in order_columns:
            op.add_column("work_orders", sa.Column(name, sa.Uuid(), nullable=True), schema="maintenance")
    if "ix_maintenance_work_orders_source_issue_id" not in _indexes("work_orders", "maintenance"):
        repeated = op.get_bind().execute(sa.text("""
            SELECT 1 FROM maintenance.work_orders WHERE source_issue_id IS NOT NULL
            GROUP BY source_issue_id HAVING count(*) > 1 LIMIT 1
        """)).first()
        if repeated:
            raise RuntimeError("Resolve duplicate issue-linked work orders before migration")
        op.create_index("ix_maintenance_work_orders_source_issue_id", "work_orders",
                        ["source_issue_id"], unique=True, schema="maintenance")
    checks = {item["name"] for item in sa.inspect(op.get_bind()).get_check_constraints(
        "work_orders", schema="maintenance")}
    if "ck_work_order_location" not in checks:
        op.create_check_constraint("ck_work_order_location", "work_orders",
            "asset_id IS NOT NULL OR room_id IS NOT NULL", schema="maintenance")


def downgrade() -> None:
    raise RuntimeError("Schema repair cannot be safely reversed across mixed migration histories")
