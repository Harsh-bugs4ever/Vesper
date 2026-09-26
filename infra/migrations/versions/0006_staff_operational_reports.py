"""Operational report ownership and room-linked corrective work orders."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    conflict = bind.execute(sa.text("""
        SELECT 1 FROM frontdesk.stays WHERE status = 'in_house'
        GROUP BY property_id, room_id HAVING count(*) > 1 LIMIT 1
    """)).first()
    repeated_booking = bind.execute(sa.text("""
        SELECT 1 FROM frontdesk.stays GROUP BY booking_id HAVING count(*) > 1 LIMIT 1
    """)).first()
    if conflict or repeated_booking:
        raise RuntimeError("Resolve duplicate open room allocations or booking stays before migration")
    op.add_column("issue_reports", sa.Column("reporter_department_id", sa.Uuid(), nullable=True), schema="guest")
    op.add_column("issue_reports", sa.Column("responsible_manager_id", sa.Uuid(), nullable=True), schema="guest")
    op.add_column("issue_reports", sa.Column("evidence", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")), schema="guest")
    op.add_column("issue_reports", sa.Column("work_order_id", sa.Uuid(), nullable=True), schema="guest")
    op.create_index("ix_guest_issue_reports_work_order_id", "issue_reports", ["work_order_id"], schema="guest")
    op.alter_column("work_orders", "asset_id", nullable=True, schema="maintenance")
    op.add_column("work_orders", sa.Column("room_id", sa.Uuid(), nullable=True), schema="maintenance")
    op.add_column("work_orders", sa.Column("source_issue_id", sa.Uuid(), nullable=True), schema="maintenance")
    op.create_index("ix_maintenance_work_orders_source_issue_id", "work_orders", ["source_issue_id"], unique=True, schema="maintenance")
    op.create_check_constraint("ck_work_order_location", "work_orders", "asset_id IS NOT NULL OR room_id IS NOT NULL", schema="maintenance")
    op.create_index("uq_frontdesk_stays_open_room", "stays", ["property_id", "room_id"], unique=True, schema="frontdesk", postgresql_where=sa.text("status = 'in_house'"))
    op.create_index("uq_frontdesk_stays_booking", "stays", ["booking_id"], unique=True, schema="frontdesk")
    # Existing staff keep only explicit front-office grants. Managers receive their
    # new department/report privileges through stored role rows.
    op.execute("""
        UPDATE identity.roles SET permissions = ARRAY(
            SELECT DISTINCT grant FROM unnest(permissions || ARRAY[
                'tasks:pool_read', 'reports:read', 'reports:approve'
            ]::varchar[]) AS grants(grant) ORDER BY grant
        ) WHERE key = 'manager'
    """)
    op.execute("""
        UPDATE identity.roles SET permissions = ARRAY(
            SELECT DISTINCT grant FROM unnest(permissions || ARRAY[
                'reports:read', 'reports:approve'
            ]::varchar[]) AS grants(grant) ORDER BY grant
        ) WHERE key = 'gm'
    """)
    op.execute("""
        UPDATE identity.roles SET permissions = ARRAY(
            SELECT DISTINCT grant FROM unnest(permissions || ARRAY['reports:write']::varchar[])
            AS grants(grant) ORDER BY grant
        ) WHERE key = 'staff'
    """)
    op.execute("""
        UPDATE identity.users AS u SET extra_permissions = ARRAY(
            SELECT DISTINCT grant FROM unnest(u.extra_permissions || ARRAY[
                'bookings:read', 'bookings:write', 'guests:read', 'tasks:pool_read'
            ]::varchar[]) AS grants(grant) ORDER BY grant
        ) FROM identity.roles AS r
        WHERE u.role_id = r.id AND r.key = 'staff'
          AND EXISTS (
            SELECT 1 FROM identity.user_assignments AS a
            JOIN property.departments AS d ON d.id = a.department_id
            WHERE a.user_id = u.id AND a.property_id = u.property_id
              AND d.property_id = u.property_id AND d.key = 'front_office'
          )
    """)


def downgrade() -> None:
    if op.get_bind().execute(sa.text(
        "SELECT 1 FROM maintenance.work_orders WHERE asset_id IS NULL LIMIT 1"
    )).first():
        raise RuntimeError("Room-only work orders must be retained; downgrade requires a data migration")
    op.drop_index("uq_frontdesk_stays_booking", table_name="stays", schema="frontdesk")
    op.drop_index("uq_frontdesk_stays_open_room", table_name="stays", schema="frontdesk")
    op.drop_constraint("ck_work_order_location", "work_orders", schema="maintenance")
    op.drop_index("ix_maintenance_work_orders_source_issue_id", table_name="work_orders", schema="maintenance")
    op.drop_column("work_orders", "source_issue_id", schema="maintenance")
    op.drop_column("work_orders", "room_id", schema="maintenance")
    op.alter_column("work_orders", "asset_id", nullable=False, schema="maintenance")
    op.drop_index("ix_guest_issue_reports_work_order_id", table_name="issue_reports", schema="guest")
    for column in ("work_order_id", "evidence", "responsible_manager_id", "reporter_department_id"):
        op.drop_column("issue_reports", column, schema="guest")
