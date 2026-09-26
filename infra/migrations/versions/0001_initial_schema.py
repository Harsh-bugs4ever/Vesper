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

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py-common"))

from vesper_common.db import SCHEMAS, Base, import_all_models  # noqa: E402

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def _metadata():
    import_all_models(str(REPO_ROOT / "app" / "api"))
    return Base.metadata


def upgrade() -> None:
    bind = op.get_bind()
    for schema in SCHEMAS:
        op.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
    # Keep the baseline stable as later model tables are added. Their migrations own
    # creation; otherwise a fresh upgrade attempts to create them twice.
    baseline_tables = [table for table in _metadata().sorted_tables if table.name not in {
        "user_assignments", "guest_staff_reviews", "staff_performance_summaries",
    }]
    _metadata().create_all(bind=bind, tables=baseline_tables)


def downgrade() -> None:
    # Dropping the schemas takes the tables, indexes and constraints with them, which is
    # both simpler and more reliable than dropping 44 tables in dependency order.
    for schema in SCHEMAS:
        op.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
