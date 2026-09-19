"""The scheduler's safety properties.

What matters is not that it fires on time — it is that a failing job cannot take the
service down, and that three replicas do not send three copies of the same SLA alert.
"""
from __future__ import annotations

import sys
import threading
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vesper_common import scheduler as sched  # noqa: E402


class FakeRedis:
    """Just enough of the Redis surface for the lease, shared between instances."""

    def __init__(self) -> None:
        self.keys: dict[str, str] = {}
        self._lock = threading.Lock()

    def set(self, key, value, nx=False, ex=None):  # noqa: ARG002
        with self._lock:
            if nx and key in self.keys:
                return None
            self.keys[key] = value
            return True


class BrokenRedis(FakeRedis):
    def set(self, *args, **kwargs):  # noqa: ARG002
        raise OSError("redis is unreachable")


@pytest.fixture
def reachable_bus(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(type(sched.bus), "client", property(lambda self: fake), raising=False)
    monkeypatch.setattr(type(sched.bus), "available", property(lambda self: True), raising=False)
    return fake


def test_a_job_interval_must_be_sane():
    """A one-second job would hammer the database; catch it at declaration."""
    with pytest.raises(ValueError):
        sched.Job(name="too-eager", every_seconds=1, run=lambda: None)


def test_only_one_replica_runs_an_exclusive_job(reachable_bus):
    """Three replicas, one alert.

    Without the lease this is three managers getting three messages about the same
    overdue request.
    """
    runs: list[str] = []
    replicas = [sched.Scheduler("guest-service") for _ in range(3)]
    job = sched.Job(name="sweep", every_seconds=60, run=lambda: runs.append("ran"))

    for replica in replicas:
        replica._run_once(job)

    assert len(runs) == 1


def test_a_non_exclusive_job_runs_everywhere(reachable_bus):
    """Some work is per-process — cache warming, say — and must not be deduplicated."""
    runs: list[str] = []
    job = sched.Job(
        name="local", every_seconds=60, run=lambda: runs.append("ran"), exclusive=False
    )

    for _ in range(3):
        sched.Scheduler("svc")._run_once(job)

    assert len(runs) == 3


def test_a_later_interval_is_a_fresh_claim(reachable_bus):
    """The lease is per occurrence, not forever — the next tick must run again."""
    runs: list[str] = []
    scheduler = sched.Scheduler("svc")
    job = sched.Job(name="tick", every_seconds=60, run=lambda: runs.append("ran"))

    scheduler._run_once(job)
    # Simulate the next interval by clearing that bucket's key.
    reachable_bus.keys.clear()
    scheduler._run_once(job)

    assert len(runs) == 2


def test_a_failing_job_does_not_propagate(reachable_bus):
    """A scheduled job raising must never reach the loop and kill the thread."""
    def explode() -> None:
        raise RuntimeError("the database went away")

    # No exception escapes.
    sched.Scheduler("svc")._run_once(sched.Job(name="bad", every_seconds=60, run=explode))


def test_one_failing_job_does_not_stop_the_others(reachable_bus):
    """The outbox must still drain even if the SLA sweep is broken."""
    survived: list[str] = []

    def explode() -> None:
        raise RuntimeError("boom")

    scheduler = sched.Scheduler("svc")
    scheduler._run_once(sched.Job(name="bad", every_seconds=60, run=explode))
    scheduler._run_once(
        sched.Job(name="good", every_seconds=60, run=lambda: survived.append("ran"))
    )
    assert survived == ["ran"]


def test_an_unreachable_redis_still_runs_the_job(monkeypatch):
    """Failing closed would silently stop every SLA alert during a Redis blip.

    Running twice is recoverable; never running at all is not.
    """
    broken = BrokenRedis()
    monkeypatch.setattr(type(sched.bus), "client", property(lambda self: broken), raising=False)
    monkeypatch.setattr(type(sched.bus), "available", property(lambda self: True), raising=False)

    runs: list[str] = []
    sched.Scheduler("svc")._run_once(
        sched.Job(name="sweep", every_seconds=60, run=lambda: runs.append("ran"))
    )
    assert runs == ["ran"]


def test_a_paused_bus_skips_the_lease_and_runs(monkeypatch):
    """With the circuit breaker open there is no Redis to ask; do the work anyway."""
    monkeypatch.setattr(type(sched.bus), "available", property(lambda self: False), raising=False)

    runs: list[str] = []
    sched.Scheduler("svc")._run_once(
        sched.Job(name="sweep", every_seconds=60, run=lambda: runs.append("ran"))
    )
    assert runs == ["ran"]


def test_for_each_property_covers_every_property(monkeypatch):
    monkeypatch.setattr(sched, "property_ids", lambda: ["p1", "p2", "p3"])
    seen: list[str] = []
    sched.for_each_property(seen.append)()
    assert seen == ["p1", "p2", "p3"]


def test_one_bad_property_does_not_skip_the_rest(monkeypatch):
    """A resort with corrupt data must not stop the others being swept."""
    monkeypatch.setattr(sched, "property_ids", lambda: ["good1", "bad", "good2"])
    seen: list[str] = []

    def work(property_id: str) -> None:
        if property_id == "bad":
            raise RuntimeError("that one is broken")
        seen.append(property_id)

    sched.for_each_property(work)()
    assert seen == ["good1", "good2"]


def test_no_property_list_means_no_work_rather_than_a_crash(monkeypatch):
    monkeypatch.setattr(sched, "property_ids", lambda: [])
    seen: list[str] = []
    sched.for_each_property(seen.append)()
    assert seen == []


def test_a_scheduler_with_no_jobs_starts_nothing():
    assert sched.Scheduler("svc").start() is None
