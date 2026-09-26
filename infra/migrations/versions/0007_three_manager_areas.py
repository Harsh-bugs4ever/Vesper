"""Keep three manager areas; Housekeeping also owns Maintenance.

Existing Engineering, Store and Security accounts remain active as staff.
Their identities and department assignments are preserved.
"""
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE identity.users AS u SET role_id = staff.id, extra_permissions = ARRAY[]::varchar[]
        FROM identity.roles AS manager, identity.roles AS staff, property.departments AS department
        WHERE u.role_id = manager.id AND manager.key = 'manager'
          AND staff.key = 'staff' AND staff.property_id = u.property_id
          AND department.id = u.department_id AND department.property_id = u.property_id
          AND department.key NOT IN ('housekeeping', 'fnb', 'front_office')
    """)
    op.execute("""
        INSERT INTO identity.user_assignments
            (id, user_id, property_id, department_id, created_at, updated_at)
        SELECT gen_random_uuid(), u.id, u.property_id, maintenance.id, now(), now()
        FROM identity.users AS u
        JOIN identity.roles AS role ON role.id = u.role_id AND role.key = 'manager'
        JOIN property.departments AS housekeeping ON housekeeping.id = u.department_id
            AND housekeeping.key = 'housekeeping'
        JOIN property.departments AS maintenance ON maintenance.property_id = u.property_id
            AND maintenance.key = 'maintenance'
        WHERE NOT EXISTS (
            SELECT 1 FROM identity.user_assignments AS assignment
            WHERE assignment.user_id = u.id AND assignment.property_id = u.property_id
              AND assignment.department_id = maintenance.id
        )
    """)


def downgrade() -> None:
    raise RuntimeError("Manager reassignment is irreversible; restore a database backup to roll back")
