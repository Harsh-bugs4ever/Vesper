"""Alembic environment.

Points at the same metadata the bootstrap script uses, so autogenerate sees all thirteen
services' tables even though each service owns its own models.py.
"""
from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py-common"))

from vesper_common.config import settings  # noqa: E402
from vesper_common.db import SCHEMAS, Base, get_engine, import_all_models  # noqa: E402

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

import_all_models(str(REPO_ROOT / "services"))
target_metadata = Base.metadata


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    """Only manage our own schemas, never anything else in the database."""
    if type_ == "table" and obj.schema not in SCHEMAS:
        return False
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        include_schemas=True,
        include_object=include_object,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    with get_engine().connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
            include_object=include_object,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
