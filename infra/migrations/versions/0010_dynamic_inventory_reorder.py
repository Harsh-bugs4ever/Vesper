"""Demand-based inventory reorder fields and unique live suggestion key.

Revision ID: 0010
Revises: 0009
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("stock_items", sa.Column("safety_stock_days", sa.Integer(),
        nullable=False, server_default="2"), schema="inventory")
    op.add_column("stock_items", sa.Column("target_stock_days", sa.Integer(),
        nullable=False, server_default="14"), schema="inventory")
    op.add_column("stock_items", sa.Column("average_daily_usage_14d", sa.Numeric(12, 3),
        nullable=False, server_default="0"), schema="inventory")
    op.add_column("stock_items", sa.Column("reorder_threshold", sa.Numeric(12, 3),
        nullable=False, server_default="0"), schema="inventory")
    op.add_column("stock_items", sa.Column("last_threshold_calculated_at",
        sa.DateTime(timezone=True), nullable=True), schema="inventory")
    op.add_column("purchase_orders", sa.Column("reorder_key", sa.String(80), nullable=True),
        schema="inventory")
    op.create_unique_constraint("uq_purchase_orders_reorder_key", "purchase_orders",
        ["reorder_key"], schema="inventory")
    inspector = sa.inspect(op.get_bind())
    movement_indexes = {row["name"] for row in inspector.get_indexes("stock_movements", schema="inventory")}
    if "ix_stock_movements_reorder_history" not in movement_indexes:
        op.create_index("ix_stock_movements_reorder_history", "stock_movements",
            ["property_id", "item_id", "created_at", "reason"], schema="inventory")
    po_indexes = {row["name"] for row in inspector.get_indexes("purchase_orders", schema="inventory")}
    if "ix_purchase_orders_incoming_item_status" not in po_indexes:
        op.create_index("ix_purchase_orders_incoming_item_status", "purchase_orders",
            ["property_id", "item_id", "status"], schema="inventory")


def downgrade() -> None:
    op.drop_index("ix_purchase_orders_incoming_item_status", table_name="purchase_orders", schema="inventory")
    op.drop_index("ix_stock_movements_reorder_history", table_name="stock_movements", schema="inventory")
    op.drop_constraint("uq_purchase_orders_reorder_key", "purchase_orders",
        schema="inventory", type_="unique")
    op.drop_column("purchase_orders", "reorder_key", schema="inventory")
    for name in ("last_threshold_calculated_at", "reorder_threshold",
                 "average_daily_usage_14d", "target_stock_days", "safety_stock_days"):
        op.drop_column("stock_items", name, schema="inventory")
