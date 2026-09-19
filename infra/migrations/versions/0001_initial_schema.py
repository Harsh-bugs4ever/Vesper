"""Initial schema: the twelve bounded contexts and their tables.

Up to now the only way to build the database was `infra/bootstrap.py`, which runs
`create_all`. That is fine for a laptop and useless for a deployment — it cannot alter an
existing database, so the first schema change in production would have had nowhere to go.
This is the baseline every later migration builds on.

The tables themselves are created from the SQLAlchemy metadata rather than being spelled
out again here. Thirteen services own 44 tables between them; transcribing all of them
into this file by hand would give two definitions of the schema that are free to drift,
and the models are the ones the code actually reads.

Revision ID: 0001
"""
from __future__ import annotations

import sys
from pathlib import Path

from alembic import op

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py-common"))

from vesper_common.db import SCHEMAS, Base, import_all_models  # noqa: E402

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def _metadata():
    import_all_models(str(REPO_ROOT / "services"))
    return Base.metadata


def upgrade() -> None:
    bind = op.get_bind()
    for schema in SCHEMAS:
        op.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
    _metadata().create_all(bind=bind)


def downgrade() -> None:
    # Dropping the schemas takes the tables, indexes and constraints with them, which is
    # both simpler and more reliable than dropping 44 tables in dependency order.
    for schema in SCHEMAS:
        op.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
