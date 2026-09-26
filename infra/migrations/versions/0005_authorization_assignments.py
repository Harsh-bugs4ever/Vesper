"""Consolidate legacy roles and record explicit branch/department grants.

Account IDs and audit rows are deliberately untouched. Existing department membership is
backfilled as a grant; accounts without a department receive no implicit access.
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_auth"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_assignments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("identity.users.id"), nullable=False),
        sa.Column("property_id", sa.Uuid(), nullable=False),
        sa.Column("department_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "property_id", "department_id"),
        schema="identity",
    )
    op.create_index("ix_identity_user_assignments_user_id", "user_assignments", ["user_id"], schema="identity")
    op.create_index("ix_identity_user_assignments_property_id", "user_assignments", ["property_id"], schema="identity")
    op.create_index("ix_identity_user_assignments_department_id", "user_assignments", ["department_id"], schema="identity")
    # Merge into existing GM and staff rows where present; rename legacy rows otherwise.
    for old, new, label in (("owner", "gm", "General Manager"), ("supervisor", "staff", "Staff"), ("employee", "staff", "Staff")):
        op.execute(sa.text("""
            UPDATE identity.users AS u SET role_id = target.id
            FROM identity.roles AS legacy, identity.roles AS target
            WHERE u.role_id = legacy.id AND legacy.key = :old
              AND target.property_id = legacy.property_id AND target.key = :new
        """).bindparams(old=old, new=new))
        op.execute(sa.text("""
            DELETE FROM identity.roles AS legacy WHERE legacy.key = :old
              AND EXISTS (SELECT 1 FROM identity.roles AS target
                          WHERE target.property_id = legacy.property_id AND target.key = :new)
        """).bindparams(old=old, new=new))
        op.execute(sa.text("UPDATE identity.roles SET key = :new, label = :label WHERE key = :old").bindparams(old=old, new=new, label=label))
    op.execute("UPDATE identity.roles SET label = 'General Manager' WHERE key = 'gm'")
    op.execute("UPDATE identity.roles SET label = 'Staff' WHERE key = 'staff'")
    op.execute("""
        UPDATE identity.roles SET permissions = ARRAY(
            SELECT DISTINCT permission FROM unnest(
                permissions || ARRAY[
                    'users:read', 'users:write', 'roles:write', 'audit:read',
                    'dashboard:read', 'forecast:read', 'learning:read', 'simulator:run'
                ]::varchar[]
            ) AS grants(permission) ORDER BY permission
        ) WHERE key = 'gm'
    """)
    op.execute(sa.text("""
        INSERT INTO identity.user_assignments (id, user_id, property_id, department_id, created_at, updated_at)
        SELECT gen_random_uuid(), u.id, u.property_id,
               CASE WHEN r.key = 'gm' THEN NULL ELSE u.department_id END,
               now(), now()
        FROM identity.users AS u JOIN identity.roles AS r ON r.id = u.role_id
        WHERE r.key = 'gm' OR EXISTS (
            SELECT 1 FROM property.departments AS d
            WHERE d.id = u.department_id AND d.property_id = u.property_id
        )
    """))
    # Unknown/system-admin accounts are retained but disabled; they never inherit GM.
    op.execute("""
        INSERT INTO identity.roles (id, property_id, key, label, permissions, is_system, created_at, updated_at)
        SELECT gen_random_uuid(), r.property_id, 'staff', 'Staff', ARRAY[]::varchar[], true, now(), now()
        FROM identity.roles AS r
        WHERE r.key NOT IN ('gm', 'manager', 'staff')
          AND NOT EXISTS (SELECT 1 FROM identity.roles AS s WHERE s.property_id = r.property_id AND s.key = 'staff')
        GROUP BY r.property_id
    """)
    op.execute("""
        UPDATE identity.users AS u SET role_id = staff.id, is_active = false
        FROM identity.roles AS legacy, identity.roles AS staff
        WHERE u.role_id = legacy.id AND legacy.key NOT IN ('gm', 'manager', 'staff')
          AND staff.property_id = legacy.property_id AND staff.key = 'staff'
    """)
    op.execute("DELETE FROM identity.roles WHERE key NOT IN ('gm', 'manager', 'staff')")


def downgrade() -> None:
    raise RuntimeError("Role consolidation is irreversible; restore a database backup to roll back")
