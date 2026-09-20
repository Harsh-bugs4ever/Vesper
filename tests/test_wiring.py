"""Every module's startup is wired to the thing it claims to start.

This exists because of a real bug: a service gained a `jobs.py` and a `_startup()`
that started its scheduler, but `create_app(subscriptions=...)` was still pointed at
the older `_start()`. Everything imported, every test passed, the service booted
happily — and its outbox was never retried. Nothing looked wrong at a glance.

Folding the services into one process changed where that bug can hide, not whether
it can. `app/background` now starts a module's work by looking for the names its
package exports, so periodic work goes silently missing when a module has a jobs.py
but its `__init__.py` never exports `build_scheduler` — the same failure, one level
up. These tests read the source rather than importing it, so they need no database.
"""
from __future__ import annotations

import ast
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
API_DIR = REPO_ROOT / "app" / "api"

MODULE_DIRS = sorted(p for p in API_DIR.iterdir() if (p / "__init__.py").is_file())
WITH_JOBS = [p for p in MODULE_DIRS if (p / "jobs.py").exists()]
WITH_EVENTS = [
    p
    for p in MODULE_DIRS
    if (p / "events.py").exists()
    and "start_subscriptions" in (p / "events.py").read_text(encoding="utf-8")
]


def module_name(path: Path) -> str:
    return path.name


def exported_names(module_dir: Path) -> set[str]:
    """Everything `from app.api.<name> import ...` can reach."""
    tree = ast.parse((module_dir / "__init__.py").read_text(encoding="utf-8"))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            names.update(alias.asname or alias.name for alias in node.names)
        elif isinstance(node, ast.Assign):
            names.update(t.id for t in node.targets if isinstance(t, ast.Name))
    return names


def test_there_are_modules_to_check():
    """Guard against the glob silently matching nothing and vacuously passing."""
    assert MODULE_DIRS, "found no modules under app/api"
    assert WITH_JOBS, "found no modules declaring periodic jobs"
    assert WITH_EVENTS, "found no modules declaring subscriptions"


def test_every_module_is_registered():
    """A module nobody lists is a module whose routes are never mounted."""
    listed = exported_names(API_DIR)
    for module_dir in MODULE_DIRS:
        assert module_dir.name in listed, (
            f"{module_dir.name} exists under app/api but app/api/__init__.py does not "
            "import it, so its routes are never mounted and its events never consumed"
        )


@pytest.mark.parametrize("module_dir", MODULE_DIRS, ids=module_name)
def test_every_module_exports_routers(module_dir: Path):
    assert "routers" in exported_names(module_dir), (
        f"{module_dir.name} does not export `routers`, so app.main mounts nothing for it"
    )


@pytest.mark.parametrize("module_dir", WITH_JOBS, ids=module_name)
def test_modules_with_jobs_export_a_scheduler(module_dir: Path):
    """The exact bug: a scheduler that is built but never reached."""
    assert "build_scheduler" in exported_names(module_dir), (
        f"{module_dir.name} has jobs.py but its __init__.py does not export "
        "`build_scheduler` — app/background/ai_workers.py looks that name up, so its "
        "periodic work would silently never run"
    )


@pytest.mark.parametrize("module_dir", WITH_EVENTS, ids=module_name)
def test_modules_with_events_export_their_subscriptions(module_dir: Path):
    assert "start_subscriptions" in exported_names(module_dir), (
        f"{module_dir.name} defines subscriptions but does not export them — "
        "app/background/event_bus.py looks that name up, so it would consume nothing"
    )


@pytest.mark.parametrize("module_dir", WITH_JOBS, ids=module_name)
def test_each_jobs_module_declares_at_least_one_job(module_dir: Path):
    """A jobs.py that builds an empty scheduler starts nothing and says nothing."""
    tree = ast.parse((module_dir / "jobs.py").read_text(encoding="utf-8"))
    adds = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and getattr(node.func, "attr", None) == "add"
    ]
    assert adds, f"{module_dir.name}/jobs.py registers no jobs"


def test_the_entry_point_starts_both_kinds_of_background_work():
    """Neither consumers nor scheduled jobs may be dropped from startup."""
    source = (REPO_ROOT / "app" / "main.py").read_text(encoding="utf-8")
    assert "event_bus.start()" in source, "app/main.py never starts the event consumers"
    assert "ai_workers.start()" in source, "app/main.py never starts the scheduled jobs"
