"""Department requisitions, budget snapshots, and idempotent PO receipts.

Existing order and movement owners are backfilled from current item assignments.
That is the only ownership evidence available for legacy rows; all new rows snapshot
the owner at creation so later item reassignment cannot rewrite history.
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def _timestamps():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    ]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("user_assignments", schema="identity") or not inspector.has_table("room_images", schema="property"):
        raise RuntimeError("Both 0005 migration branches are required before inventory migration")

    op.create_table("department_budgets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("property_id", sa.Uuid(), nullable=False),
        sa.Column("department_id", sa.Uuid(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("allocated", sa.Numeric(14, 2), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("property_id", "department_id", "period_start", "period_end", "currency"),
        sa.CheckConstraint("period_end >= period_start", name="valid_period"),
        sa.CheckConstraint("allocated >= 0", name="nonnegative_allocation"),
        schema="inventory")
    op.create_index("ix_inventory_budget_scope", "department_budgets",
                    ["property_id", "department_id", "currency", "period_start", "period_end"], schema="inventory")

    op.create_table("inventory_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("property_id", sa.Uuid(), nullable=False),
        sa.Column("department_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by", sa.Uuid(), nullable=False),
        sa.Column("responsible_manager_id", sa.Uuid(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("reason", sa.Text()),
        sa.Column("decided_by", sa.Uuid()),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
        sa.Column("decision_reason", sa.Text()),
        *_timestamps(), schema="inventory")
    op.create_index("ix_inventory_requests_owner", "inventory_requests",
                    ["property_id", "department_id", "status"], schema="inventory")
    op.create_index("ix_inventory_requests_requester", "inventory_requests",
                    ["property_id", "requested_by"], schema="inventory")

    op.create_table("inventory_request_lines",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("request_id", sa.Uuid(), sa.ForeignKey("inventory.inventory_requests.id"), nullable=False),
        sa.Column("item_id", sa.Uuid(), sa.ForeignKey("inventory.stock_items.id"), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 3), nullable=False),
        sa.Column("unit_cost", sa.Numeric(10, 2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("quantity > 0", name="positive_quantity"), schema="inventory")
    op.create_index("ix_inventory_request_lines_request", "inventory_request_lines",
                    ["request_id"], schema="inventory")

    op.create_table("inventory_request_audit",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("request_id", sa.Uuid(), sa.ForeignKey("inventory.inventory_requests.id"), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("reason", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="inventory")
    op.create_index("ix_inventory_request_audit_request", "inventory_request_audit",
                    ["request_id", "created_at"], schema="inventory")

    op.add_column("purchase_orders", sa.Column("department_id", sa.Uuid()), schema="inventory")
    op.add_column("purchase_orders", sa.Column("budget_id", sa.Uuid(), sa.ForeignKey("inventory.department_budgets.id")), schema="inventory")
    op.add_column("purchase_orders", sa.Column("request_line_id", sa.Uuid(), sa.ForeignKey("inventory.inventory_request_lines.id")), schema="inventory")
    op.add_column("purchase_orders", sa.Column("currency", sa.String(3), nullable=True), schema="inventory")
    op.add_column("purchase_orders", sa.Column("received_quantity", sa.Numeric(12, 3), nullable=False, server_default="0"), schema="inventory")
    op.add_column("purchase_orders", sa.Column("returned_quantity", sa.Numeric(12, 3), nullable=False, server_default="0"), schema="inventory")
    op.alter_column("purchase_orders", "status", type_=sa.String(20), schema="inventory")
    op.create_index("uq_inventory_purchase_orders_request_line", "purchase_orders", ["request_line_id"],
                    unique=True, schema="inventory")
    op.create_index("ix_inventory_purchase_orders_department", "purchase_orders",
                    ["property_id", "department_id"], schema="inventory")
    op.execute("""
        UPDATE inventory.purchase_orders AS po SET department_id = item.department_id,
            currency = property.currency,
            received_quantity = CASE WHEN po.status = 'received' THEN po.quantity ELSE 0 END
        FROM inventory.stock_items AS item, property.properties AS property
        WHERE po.item_id = item.id AND po.property_id = property.id
    """)
    op.execute("UPDATE inventory.purchase_orders SET currency = 'INR' WHERE currency IS NULL")
    op.alter_column("purchase_orders", "currency", nullable=False, schema="inventory")
    op.create_check_constraint("ck_purchase_order_receipt_quantities", "purchase_orders",
        "received_quantity >= 0 AND received_quantity <= quantity AND returned_quantity >= 0 AND returned_quantity <= received_quantity",
        schema="inventory")

    op.add_column("stock_movements", sa.Column("department_id", sa.Uuid()), schema="inventory")
    op.execute("""
        UPDATE inventory.stock_movements AS movement SET department_id = item.department_id
        FROM inventory.stock_items AS item WHERE movement.item_id = item.id
    """)

    op.create_table("purchase_operations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("order_id", sa.Uuid(), sa.ForeignKey("inventory.purchase_orders.id"), nullable=False),
        sa.Column("operation_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 3), nullable=False),
        sa.Column("movement_id", sa.Uuid(), sa.ForeignKey("inventory.stock_movements.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("order_id", "operation_id"),
        sa.CheckConstraint("quantity > 0", name="positive_quantity"), schema="inventory")

    for role, grants in (
        ("staff", ["requisition:write"]),
        ("manager", ["purchase:read", "requisition:read", "requisition:approve", "budget:read"]),
        ("gm", ["purchase:read", "requisition:read", "budget:read", "budget:manage"]),
    ):
        bind.execute(sa.text("""
            UPDATE identity.roles SET permissions = ARRAY(
                SELECT DISTINCT permission FROM unnest(permissions || CAST(:grants AS varchar[]))
                    AS grants(permission) ORDER BY permission
            ) WHERE key = :role
        """).bindparams(grants=grants, role=role))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.execute(sa.text("SELECT 1 FROM inventory.inventory_requests LIMIT 1")).first() or \
       bind.execute(sa.text("SELECT 1 FROM inventory.purchase_operations LIMIT 1")).first() or \
       bind.execute(sa.text("SELECT 1 FROM inventory.department_budgets LIMIT 1")).first():
        raise RuntimeError("Inventory financial history exists; export and reconcile before downgrade")
    op.drop_table("purchase_operations", schema="inventory")
    op.drop_column("stock_movements", "department_id", schema="inventory")
    op.drop_constraint("ck_purchase_order_receipt_quantities", "purchase_orders", schema="inventory")
    op.alter_column("purchase_orders", "status", type_=sa.String(16), schema="inventory")
    op.drop_index("ix_inventory_purchase_orders_department", table_name="purchase_orders", schema="inventory")
    op.drop_index("uq_inventory_purchase_orders_request_line", table_name="purchase_orders", schema="inventory")
    for name in ("returned_quantity", "received_quantity", "currency", "request_line_id", "budget_id", "department_id"):
        op.drop_column("purchase_orders", name, schema="inventory")
    op.drop_index("ix_inventory_request_audit_request", table_name="inventory_request_audit", schema="inventory")
    op.drop_table("inventory_request_audit", schema="inventory")
    op.drop_index("ix_inventory_request_lines_request", table_name="inventory_request_lines", schema="inventory")
    op.drop_table("inventory_request_lines", schema="inventory")
    op.drop_index("ix_inventory_requests_requester", table_name="inventory_requests", schema="inventory")
    op.drop_index("ix_inventory_requests_owner", table_name="inventory_requests", schema="inventory")
    op.drop_table("inventory_requests", schema="inventory")
    op.drop_index("ix_inventory_budget_scope", table_name="department_budgets", schema="inventory")
    op.drop_table("department_budgets", schema="inventory")
