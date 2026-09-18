"""Make the whole suite runnable in one pytest process.

Every service names its package `app`, which is the right call inside a container but
means that in a single process the first service imported wins and the rest fail with
`ModuleNotFoundError: No module named 'app.engines'`.

Before each test module is imported, this puts its own service directory at the front of
`sys.path` and evicts any `app` package left over from the previous service, so
`from app.engines import roster` resolves to the roster engine and nothing else.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
PY_COMMON = REPO_ROOT / "packages" / "py-common"

if str(PY_COMMON) not in sys.path:
    sys.path.insert(0, str(PY_COMMON))


def _owning_service(module_path: Path) -> Path | None:
    """The services/<name> directory a test file belongs to, if any."""
    for parent in module_path.parents:
        if parent.parent.name == "services" and (parent / "app").is_dir():
            return parent
    return None


def pytest_pycollect_makemodule(module_path: Path, parent):  # noqa: ARG001
    service_dir = _owning_service(Path(module_path))
    if service_dir is None:
        return None

    # Drop the previous service's `app` so this one is imported fresh.
    for name in [m for m in sys.modules if m == "app" or m.startswith("app.")]:
        del sys.modules[name]

    # Keep other service dirs from shadowing this one.
    for entry in [p for p in sys.path if (Path(p) / "app").is_dir()]:
        sys.path.remove(entry)
    sys.path.insert(0, str(service_dir))
    return None
