"""Test configuration.

This used to be forty lines of `sys.path` surgery: every service named its package
`app`, so in a single pytest process the first one imported won and the rest failed
with `ModuleNotFoundError: No module named 'app.engines'`. Each test module had to
have its own service directory swapped to the front of the path first.

There is one `app` package now, so that problem no longer exists — the repository
root on `sys.path` is the whole of it. The shared package is added too, because it
is a sibling rather than an installed dependency when running from a checkout.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent

for entry in (REPO_ROOT, REPO_ROOT / "packages" / "py-common"):
    if str(entry) not in sys.path:
        sys.path.insert(0, str(entry))
