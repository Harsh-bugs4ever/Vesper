"""Export every service's OpenAPI spec to packages/contracts/openapi/.

Generated from the running code, so the contracts the frontend builds against can never
drift from what the backend actually serves. Run `make contracts` after changing a route.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py-common"))

OUT_DIR = REPO_ROOT / "packages" / "contracts" / "openapi"


def _load_app(service_dir: Path):
    """Import services/<name>/app as the package `app`, exactly as uvicorn does.

    Every service names its package `app`, so each one has to be loaded under that name
    and then evicted before the next.
    """
    for module in [m for m in sys.modules if m == "app" or m.startswith("app.")]:
        del sys.modules[module]

    sys.path.insert(0, str(service_dir))
    try:
        spec = importlib.util.spec_from_file_location(
            "app",
            service_dir / "app" / "__init__.py",
            submodule_search_locations=[str(service_dir / "app")],
        )
        package = importlib.util.module_from_spec(spec)
        sys.modules["app"] = package
        spec.loader.exec_module(package)
        return importlib.import_module("app.main").app
    finally:
        sys.path.remove(str(service_dir))


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    services = sorted(
        path.parent.parent.name
        for path in REPO_ROOT.glob("services/*/app/main.py")
        if path.stat().st_size
    )

    total = 0
    failed: list[tuple[str, str]] = []
    for name in services:
        try:
            schema = _load_app(REPO_ROOT / "services" / name).openapi()
        except Exception as exc:  # noqa: BLE001 - report them all, don't stop at the first
            failed.append((name, f"{type(exc).__name__}: {exc}"))
            continue
        # Sorted keys and a trailing newline keep the diff readable when a route changes.
        (OUT_DIR / f"{name}.json").write_text(
            json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        endpoints = sum(len(operations) for operations in schema.get("paths", {}).values())
        total += endpoints
        print(f"  {name:24} {endpoints:3} endpoints")

    for name, error in failed:
        print(f"  {name:24} FAILED  {error}", file=sys.stderr)

    print(f"\nwrote {len(services) - len(failed)} specs, {total} endpoints -> {OUT_DIR.relative_to(REPO_ROOT)}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
