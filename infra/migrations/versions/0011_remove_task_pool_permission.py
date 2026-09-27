"""Remove the retired staff task-pool permission.

Revision ID: 0011
Revises: 0010
"""
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE identity.roles
        SET permissions = array_remove(permissions, 'tasks:pool_read')
        WHERE 'tasks:pool_read' = ANY(permissions)
    """)
    op.execute("""
        UPDATE identity.users
        SET extra_permissions = array_remove(extra_permissions, 'tasks:pool_read')
        WHERE 'tasks:pool_read' = ANY(extra_permissions)
    """)


def downgrade() -> None:
    pass
