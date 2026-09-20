"""Database session and declarative base.

One PostgreSQL database, one schema per bounded context. The schemas outlive the
split into services: a module still reads only its own tables, so pulling one back out
remains a deployment change rather than a rewrite.
"""
from collections.abc import Iterator
from datetime import datetime
from typing import Any

from uuid import UUID, uuid4

from sqlalchemy import DateTime, MetaData, String, create_engine, func
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .config import settings

SCHEMAS = (
    "identity",
    "property",
    "staff",
    "guest",
    "inventory",
    "frontdesk",
    "action",
    "revenue",
    "maintenance",
    "workforce",
    "guest_intel",
    "notification",
)

naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=naming_convention)

# Built on first use, not at import. A service that never touches the database (the
# gateway, notification) should not need the driver installed, and importing a module
# for its constants should not open a connection pool.
_engine = None
SessionLocal = sessionmaker(autoflush=False, expire_on_commit=False)


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
        SessionLocal.configure(bind=_engine)
    return _engine


class Base(DeclarativeBase):
    metadata = metadata


def uuid_pk() -> Mapped[UUID]:
    """Every table uses a UUID primary key: ids travel across services and into QR codes."""
    return mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)


def uuid_fk(target: str, *, nullable: bool = False, index: bool = True) -> Mapped[UUID]:
    from sqlalchemy import ForeignKey

    return mapped_column(PgUUID(as_uuid=True), ForeignKey(target), nullable=nullable, index=index)


def uuid_ref(*, nullable: bool = True, index: bool = True) -> Mapped[UUID]:
    """A pointer to a row another service owns — deliberately not a foreign key."""
    return mapped_column(PgUUID(as_uuid=True), nullable=nullable, index=index)


def short(length: int = 64, **kw) -> Mapped[str]:
    return mapped_column(String(length), **kw)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one session per request, committed by the caller."""
    get_engine()
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def session_scope() -> Session:
    """For scripts and background jobs, where there is no request to hang off."""
    get_engine()
    return SessionLocal()


def import_all_models(models_root: str | None = None) -> None:
    """Import every module's models.py so Base.metadata describes the whole database.

    Each bounded context owns its own models.py (see app/api/<name>/models.py) and they
    all hang off one Base, so Alembic and the bootstrap script only see the complete
    picture once every one of them has been imported. The monolith gets that for free by
    importing app.api; this exists for the callers that must not — Alembic and bootstrap
    run against the schema without starting the application.

    Loading by path rather than by import keeps this package independent of the
    application package that sits above it.
    """
    import importlib.util
    import sys
    import types
    from pathlib import Path

    root = (
        Path(models_root)
        if models_root
        else Path(__file__).resolve().parents[3] / "app" / "api"
    )
    if not root.is_dir():
        return

    # Register the parent namespace first. Without it, `import vesper_models.staff`
    # fails on the parent lookup even though the submodule is already in sys.modules.
    if "vesper_models" not in sys.modules:
        parent = types.ModuleType("vesper_models")
        parent.__path__ = []  # a namespace package, with no directory of its own
        sys.modules["vesper_models"] = parent
    for models_file in sorted(root.glob("*/models.py")):
        context = models_file.parent.name.replace("-", "_")
        module_name = f"vesper_models.{context}"
        if module_name in sys.modules:
            continue
        spec = importlib.util.spec_from_file_location(module_name, models_file)
        if spec is None or spec.loader is None:
            continue
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        # Expose it as an attribute too, so `from vesper_models import staff` works.
        setattr(sys.modules["vesper_models"], context, module)


def json_default(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    raise TypeError(f"not JSON serialisable: {type(value)!r}")
