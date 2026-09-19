"""Periodic work owned by identity-service.

The only job here keeps the shipped roles in step with the code. It matters because the
permission matrix lives in two places at once: `vesper_common.permissions` is what the
code checks against, and the `identity.roles` rows are what a running deployment actually
grants. Adding a permission to a role in code and forgetting the database is a silent
failure — the endpoint 403s for exactly the role that was meant to have it.

Running it on a timer rather than only at boot also means a deployment that adds a
property picks up the standard roles without anyone remembering to reseed.
"""
import logging
from uuid import UUID

from vesper_common.db import session_scope
from vesper_common.scheduler import Scheduler, for_each_property

from . import service

log = logging.getLogger(__name__)


def _sync_roles(property_id: str) -> None:
    db = session_scope()
    try:
        service.ensure_default_roles(db, UUID(property_id))
    finally:
        db.close()


def build() -> Scheduler:
    scheduler = Scheduler("identity-service")
    # Hourly is plenty: this only changes when the code does, and the scheduler's startup
    # delay already covers the common case of a fresh deploy.
    scheduler.add("sync-system-roles", 3600, for_each_property(_sync_roles))
    return scheduler
