"""Give a property a street address.

The frontend printed the resort's address from a constant compiled into the bundle,
which meant the address on screen and the property in the database could disagree and
nothing would notice. It is a fact about the business, so it belongs with the business.

Nullable on purpose: a property is perfectly usable without an address, and existing
rows must not have to invent one to survive the upgrade. `city` stays as it was and is
still the field anything that groups or filters should use.

Revision ID: 0004
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "address" in {column["name"] for column in sa.inspect(op.get_bind()).get_columns("properties", schema="property")}:
        return
    op.add_column(
        "properties",
        sa.Column("address", sa.String(length=240), nullable=True),
        schema="property",
    )


def downgrade() -> None:
    op.drop_column("properties", "address", schema="property")
