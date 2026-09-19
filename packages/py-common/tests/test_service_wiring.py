"""Every service's startup is wired to the thing it claims to start.

This exists because of a real bug: a service gained a `jobs.py` and a `_startup()` that
started its scheduler, but `create_app(subscriptions=...)` was still pointed at the older
`_start()`. Everything imported, every test passed, the service booted happily — and its
outbox was never retried. Nothing in the code looked wrong at a glance.

These read each service's `main.py` rather than importing it, so they need no database.
"""
from __future__ import annotations

import ast
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SERVICES_DIR = REPO_ROOT / "services"

SERVICE_MAINS = sorted(
    p for p in SERVICES_DIR.glob("*/app/main.py") if p.stat().st_size
)
# Only the services that actually declare periodic work.
WITH_JOBS = [p for p in SERVICE_MAINS if (p.parent / "jobs.py").exists()]


def _subscribes_to_events(main_path: Path) -> bool:
    events = main_path.parent / "events.py"
    return events.exists() and "@on_events" in events.read_text(encoding="utf-8")


# Services that declare work at startup. The gateway is deliberately absent: it holds no
# business logic and consumes no events, so it has nothing to start.
WITH_STARTUP = [p for p in SERVICE_MAINS if _subscribes_to_events(p) or (p.parent / "jobs.py").exists()]


def service_name(path: Path) -> str:
    return path.parents[1].name


def parse(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"))


def subscriptions_argument(tree: ast.Module) -> str | None:
    """The name passed as create_app(subscriptions=...)."""
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and getattr(node.func, "id", None) == "create_app"):
            continue
        for keyword in node.keywords:
            if keyword.arg == "subscriptions" and isinstance(keyword.value, ast.Name):
                return keyword.value.id
    return None


def function_body_source(tree: ast.Module, name: str, source: str) -> str:
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return ast.get_source_segment(source, node) or ""
    return ""


def test_there_are_services_to_check():
    """Guard against the glob silently matching nothing and vacuously passing."""
    assert SERVICE_MAINS, "found no service main.py files"
    assert WITH_JOBS, "found no services declaring periodic jobs"
    assert WITH_STARTUP, "found no services declaring startup work"


@pytest.mark.parametrize("main_path", WITH_STARTUP, ids=service_name)
def test_every_service_with_work_names_a_startup_function(main_path: Path):
    tree = parse(main_path)
    assert subscriptions_argument(tree) is not None, (
        f"{service_name(main_path)} does not pass subscriptions= to create_app"
    )


@pytest.mark.parametrize("main_path", WITH_JOBS, ids=service_name)
def test_the_startup_function_actually_starts_the_scheduler(main_path: Path):
    """The exact bug: a scheduler started inside a function nobody calls."""
    source = main_path.read_text(encoding="utf-8")
    tree = parse(main_path)
    name = subscriptions_argument(tree)
    body = function_body_source(tree, name, source)

    assert body, f"{service_name(main_path)}: subscriptions={name} is not defined in main.py"
    assert "build_scheduler().start()" in body, (
        f"{service_name(main_path)} has jobs.py but subscriptions={name}() never starts "
        "the scheduler — its periodic work would silently never run"
    )


@pytest.mark.parametrize("main_path", SERVICE_MAINS, ids=service_name)
def test_no_orphaned_startup_functions(main_path: Path):
    """A second startup function that nothing calls is dead code pretending to work."""
    source = main_path.read_text(encoding="utf-8")
    tree = parse(main_path)
    wired = subscriptions_argument(tree)

    startup_like = [
        node.name
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name.lstrip("_").startswith("start")
    ]
    orphans = [
        name
        for name in startup_like
        if name != wired and f"{name}()" not in source.replace(f"def {name}()", "")
    ]
    assert not orphans, (
        f"{service_name(main_path)} defines {orphans} which nothing calls; "
        f"create_app uses {wired!r}"
    )


@pytest.mark.parametrize("main_path", WITH_JOBS, ids=service_name)
def test_the_scheduler_import_is_present(main_path: Path):
    source = main_path.read_text(encoding="utf-8")
    assert "build_scheduler" in source and "import" in source, (
        f"{service_name(main_path)} calls build_scheduler without importing it"
    )


@pytest.mark.parametrize("main_path", WITH_JOBS, ids=service_name)
def test_each_jobs_module_declares_at_least_one_job(main_path: Path):
    """A jobs.py that builds an empty scheduler starts nothing and says nothing."""
    jobs = main_path.parent / "jobs.py"
    tree = parse(jobs)
    adds = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and getattr(node.func, "attr", None) == "add"
    ]
    assert adds, f"{service_name(main_path)}/jobs.py registers no jobs"
