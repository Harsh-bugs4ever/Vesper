"""Export the OpenAPI spec to packages/contracts/openapi/.

Generated from the running code, so the contract the frontend builds against can
never drift from what the backend actually serves. Run `make contracts` after
changing a route.

There were thirteen specs here, one per service, and the gateway's was empty — it
proxied by wildcard and so described nothing. There is one spec now, and it is the
whole public surface.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "packages" / "py-common"))

OUT_DIR = REPO_ROOT / "packages" / "contracts" / "openapi"
OUT_FILE = OUT_DIR / "vesper.json"


def main() -> int:
    from app.main import app

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    schema = app.openapi()

    # Sorted keys and a trailing newline keep the diff readable when a route changes.
    OUT_FILE.write_text(
        json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    paths = schema.get("paths", {})
    endpoints = sum(len(operations) for operations in paths.values())

    # Count by prefix, so the output still shows the shape of the system.
    by_area: dict[str, int] = {}
    for path, operations in paths.items():
        area = path.strip("/").split("/", 1)[0] or "root"
        by_area[area] = by_area.get(area, 0) + len(operations)
    for area, count in sorted(by_area.items()):
        print(f"  /{area:22} {count:3} endpoints")

    # The per-service specs described services that no longer exist. Left behind they
    # would be read as current and generate a client for a backend nobody is running.
    stale = [p for p in OUT_DIR.glob("*.json") if p != OUT_FILE]
    for path in stale:
        path.unlink()
    if stale:
        print(f"\nremoved {len(stale)} spec(s) from the per-service layout")

    print(f"\nwrote {endpoints} endpoints -> {OUT_FILE.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
