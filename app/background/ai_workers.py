"""The scheduled half of the product.

A lot of Vesper only behaves correctly because something runs on a timer: the
demand forecast is refitted overnight, sensor readings are swept for anomalies, a
request that crosses its SLA alerts a manager, a failed notification is retried.
Those are the engines' entry points — on a schedule rather than on request.

As thirteen services this was thirteen scheduler threads, one per container. It
still is: each module builds its own `Scheduler` with its own jobs and intervals,
and they are started here together. Keeping them separate is deliberate — a job
that overruns delays only its own module's queue, and the Redis lease per job per
interval still means a second replica of this process does not double every job.
"""
from __future__ import annotations

import logging

from app.api import MODULES

log = logging.getLogger(__name__)

_schedulers: list = []


def start() -> None:
    """Build and start every module's scheduler. Called once, from the lifespan hook."""
    for module in MODULES:
        build = getattr(module, "build_scheduler", None)
        if build is None:
            continue
        try:
            scheduler = build()
            scheduler.start()
        except Exception:
            log.exception("could not start the scheduler for %s", module.NAME)
        else:
            _schedulers.append(scheduler)
    log.info("%s scheduler(s) running", len(_schedulers))


async def stop() -> None:
    """Ask every scheduler to finish its tick and stop. Called on shutdown."""
    for scheduler in _schedulers:
        scheduler.stop()
    _schedulers.clear()
