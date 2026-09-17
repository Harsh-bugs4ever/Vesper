"""Database session and declarative base.

All thirteen services share one PostgreSQL database with one schema per bounded context,
so the whole demo runs on a laptop. Services still never read each other's tables — that
rule is enforced by review, and splitting the databases later is a deployment change.
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

engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


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
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def session_scope() -> Session:
    """For scripts and background jobs, where there is no request to hang off."""
    return SessionLocal()


def import_all_models(services_root: str | None = None) -> None:
    """Import every service's models.py so Base.metadata describes the whole database.

    Each service owns its own models.py (see services/<name>/app/models.py), but they all
    hang off one Base. Alembic and the bootstrap script need the complete picture, so we
    load each file by path under a unique module name — every service package is called
    "app", so a plain import would collide.
    """
    import importlib.util
    import sys
    from pathlib import Path

    root = Path(services_root) if services_root else Path(__file__).resolve().parents[3] / "services"
    if not root.is_dir():
        return
    for models_file in sorted(root.glob("*/app/models.py")):
        service = models_file.parents[1].name.replace("-", "_")
        module_name = f"vesper_models.{service}"
        if module_name in sys.modules:
            continue
        spec = importlib.util.spec_from_file_location(module_name, models_file)
        if spec is None or spec.loader is None:
            continue
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)


def json_default(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    raise TypeError(f"not JSON serialisable: {type(value)!r}")
