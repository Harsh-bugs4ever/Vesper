"""Periodic work.

A lot of the product only behaves correctly if something runs on a timer: a request that
crosses its SLA has to alert a manager, a failed WhatsApp has to be retried, the demand
forecast has to be refitted overnight. Every one of those had an endpoint and nothing
calling it, which meant none of them ever happened.

Each service declares its own jobs and this runs them on a daemon thread. Two properties
make it safe to run in more than one replica:

  * **A Redis lease per job per interval.** Three replicas wake at the same second; one
    wins the lease and the others skip. Without it, three managers get three alerts for
    the same overdue request, and the forecast is refitted three times.
  * **A job never takes the service down.** Exceptions are logged and the loop carries
    on to the next tick.

Deliberately not APScheduler or Celery: one thread and a Redis key is the whole
requirement here, and a scheduler you can read in one sitting is worth more than one
with features nobody uses. If jobs ever need to survive a restart mid-run or fan out
across machines, that is the point to reach for a real queue.
"""
from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from uuid import uuid4

import redis

from .config import settings
from .events import bus

log = logging.getLogger(__name__)

# How long a lease is held. Comfortably longer than any job here takes, short enough
# that a replica which dies mid-job does not block the next tick for long.
LEASE_SECONDS = 300
# Don't fire everything the instant a service boots: thirteen services starting at once
# would all hit the database in the same moment.
STARTUP_DELAY_SECONDS = 15


@dataclass(slots=True)
class Job:
    name: str
    every_seconds: int
    run: Callable[[], None]
    # False for jobs that are safe (or required) to run in every replica.
    exclusive: bool = True

    def __post_init__(self) -> None:
        if self.every_seconds < 5:
            raise ValueError(f"job {self.name!r} interval is too short")


class Scheduler:
    def __init__(self, service: str) -> None:
        self.service = service
        self._jobs: list[Job] = []
        self._thread: threading.Thread | None = None
        self._instance = uuid4().hex[:8]
        self._stop = threading.Event()

    def add(
        self,
        name: str,
        every_seconds: int,
        run: Callable[[], None],
        *,
        exclusive: bool = True,
    ) -> None:
        self._jobs.append(Job(name=name, every_seconds=every_seconds, run=run, exclusive=exclusive))

    def start(self) -> threading.Thread | None:
        if not self._jobs:
            return None

        def loop() -> None:
            # Each job's next due time, so a slow job cannot delay the others' schedule.
            due = {job.name: time.monotonic() + STARTUP_DELAY_SECONDS for job in self._jobs}
            while not self._stop.is_set():
                now = time.monotonic()
                for job in self._jobs:
                    if now < due[job.name]:
                        continue
                    due[job.name] = now + job.every_seconds
                    self._run_once(job)
                # One second of granularity is far finer than any interval here.
                self._stop.wait(1.0)

        self._thread = threading.Thread(target=loop, name=f"scheduler-{self.service}", daemon=True)
        self._thread.start()
        log.info(
            "scheduler started with %s job(s): %s",
            len(self._jobs),
            ", ".join(f"{j.name}/{j.every_seconds}s" for j in self._jobs),
        )
        return self._thread

    def stop(self) -> None:
        self._stop.set()

    def _run_once(self, job: Job) -> None:
        if job.exclusive and not self._acquire(job):
            log.debug("another replica holds %s this interval", job.name)
            return
        started = time.monotonic()
        try:
            job.run()
        except Exception:
            # A failing job must never stop the others or kill the service.
            log.exception("scheduled job %r failed", job.name)
        else:
            elapsed = time.monotonic() - started
            if elapsed > job.every_seconds:
                # It cannot keep up, so it will now run back-to-back forever.
                log.warning(
                    "job %r took %.1fs, longer than its %ss interval",
                    job.name,
                    elapsed,
                    job.every_seconds,
                )
            else:
                log.debug("job %r finished in %.2fs", job.name, elapsed)

    def _acquire(self, job: Job) -> bool:
        """Claim this job for this interval.

        The key is bucketed by interval, so exactly one replica runs each occurrence. If
        Redis is unreachable we run anyway: with the bus down there is only one replica
        worth speaking of on a laptop, and skipping the work entirely would be worse
        than the small risk of doing it twice.
        """
        if not bus.available:
            return True
        bucket = int(time.time()) // job.every_seconds
        key = f"vesper:sched:{self.service}:{job.name}:{bucket}"
        try:
            return bool(bus.client.set(key, self._instance, nx=True, ex=LEASE_SECONDS))
        except (redis.RedisError, OSError):
            log.warning("could not take the lease for %s; running anyway", job.name)
            return True


def for_each_property(work: Callable[[str], None]) -> Callable[[], None]:
    """Wrap a per-property job so it runs for every property the deployment serves.

    One property today, but nothing in a scheduled job should assume that — the moment a
    second resort is added, a job hardcoded to the first silently stops covering half the
    business.
    """

    def run() -> None:
        for property_id in property_ids():
            try:
                work(property_id)
            except Exception:
                log.exception("job failed for property %s", property_id)

    return run


def property_ids() -> list[str]:
    """Every property id, read from property-service.

    Cached briefly: a job running every minute should not ask thirteen times an hour for
    a list that changes when somebody onboards a resort.
    """
    global _cached_ids, _cached_at
    now = time.monotonic()
    if _cached_ids is not None and now - _cached_at < PROPERTY_CACHE_SECONDS:
        return _cached_ids

    from .clients import property_client, service_token

    # No property id to scope the token to yet — that is what we are asking for — so the
    # token is minted against the wildcard and property-service only returns ids.
    rows = property_client.get(
        "/property/ids", property_id=WILDCARD, token=service_token(WILDCARD)
    )
    if rows is None:
        log.warning("could not read the property list; skipping this tick")
        return []
    _cached_ids = [str(r) for r in rows]
    _cached_at = now
    return _cached_ids


PROPERTY_CACHE_SECONDS = 300
# A placeholder property id for the one call that exists to discover property ids.
WILDCARD = "00000000-0000-0000-0000-000000000000"

_cached_ids: list[str] | None = None
_cached_at: float = 0.0
