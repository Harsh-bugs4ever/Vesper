"""Create the schemas and tables for every service.

Alembic owns migrations from the second deployment onward; this is what makes the first
one possible, and what `make db-reset` runs to get a clean laptop database.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py-common"))

from sqlalchemy import text  # noqa: E402

from vesper_common.db import SCHEMAS, Base, get_engine, import_all_models  # noqa: E402


def create_schemas(engine) -> None:
    """One PostgreSQL schema per bounded context, all in one database."""
    with engine.begin() as connection:
        for schema in SCHEMAS:
            connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))


def main() -> int:
    parser = argparse.ArgumentParser(description="Create the Vesper database objects")
    parser.add_argument(
        "--drop",
        action="store_true",
        help="Drop every schema first. Destroys all data — development only.",
    )
    args = parser.parse_args()

    engine = get_engine()
    import_all_models(str(REPO_ROOT / "services"))

    if args.drop:
        with engine.begin() as connection:
            for schema in SCHEMAS:
                connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        print(f"dropped {len(SCHEMAS)} schemas")

    create_schemas(engine)
    Base.metadata.create_all(engine)
    print(f"created {len(Base.metadata.tables)} tables across {len(SCHEMAS)} schemas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
