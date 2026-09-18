"""Run every service on this machine, without Docker.

`make up` is the normal path. This is for a laptop with no Docker: it starts all
thirteen uvicorn processes against a Postgres and Redis you already have running, and
shuts them all down together on Ctrl-C.

    python scripts/run_local.py                 # everything
    python scripts/run_local.py identity gateway   # just these

Each service's package is called `app`, so every process gets its own service directory
on PYTHONPATH — that is what `--app-dir` does below.
"""
from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
PY_COMMON = REPO_ROOT / "packages" / "py-common"

SERVICES: dict[str, int] = {
    "api-gateway": 8000,
    "identity-service": 8001,
    "property-service": 8002,
    "staff-service": 8003,
    "guest-service": 8004,
    "inventory-service": 8005,
    "frontdesk-service": 8006,
    "action-service": 8007,
    "revenue-service": 8008,
    "maintenance-service": 8009,
    "workforce-service": 8010,
    "guest-intel-service": 8011,
    "notification-service": 8012,
}


def resolve(names: list[str]) -> dict[str, int]:
    if not names:
        return SERVICES
    chosen: dict[str, int] = {}
    for name in names:
        # Accept "identity", "identity-service" or "gateway".
        for full in SERVICES:
            if full == name or full.replace("-service", "") == name or full.endswith(name):
                chosen[full] = SERVICES[full]
                break
        else:
            raise SystemExit(f"unknown service {name!r}; choose from {', '.join(SERVICES)}")
    return chosen


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Vesper services locally")
    parser.add_argument("services", nargs="*", help="Service names (default: all)")
    parser.add_argument("--reload", action="store_true", help="Restart on code changes")
    parser.add_argument("--log-dir", default=str(REPO_ROOT / ".logs"))
    args = parser.parse_args()

    chosen = resolve(args.services)
    log_dir = Path(args.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)

    base_env = os.environ.copy()
    # The service URLs default to docker-compose hostnames ("http://identity-service:8001"),
    # which do not resolve on a laptop. Point every one at loopback unless the caller has
    # already overridden it.
    for name, port in SERVICES.items():
        key = "VESPER_" + name.replace("-service", "").replace("-", "_").upper() + "_URL"
        if name == "api-gateway":
            continue
        base_env.setdefault(key, f"http://127.0.0.1:{port}")
    # The shared package plus, per process, that service's own directory.
    base_env["PYTHONPATH"] = os.pathsep.join(
        [str(PY_COMMON), base_env.get("PYTHONPATH", "")]
    ).strip(os.pathsep)

    processes: list[tuple[str, subprocess.Popen, Path]] = []
    for name, port in chosen.items():
        service_dir = REPO_ROOT / "services" / name
        log_path = log_dir / f"{name}.log"
        env = base_env.copy()
        env["VESPER_SERVICE_NAME"] = name

        command = [
            sys.executable, "-m", "uvicorn", "app.main:app",
            "--app-dir", str(service_dir),
            "--host", "127.0.0.1", "--port", str(port),
            "--log-level", "info",
        ]
        if args.reload:
            command += ["--reload", "--reload-dir", str(service_dir / "app")]

        handle = log_path.open("w", encoding="utf-8")
        process = subprocess.Popen(command, env=env, stdout=handle, stderr=subprocess.STDOUT)
        processes.append((name, process, log_path))
        print(f"  {name:24} :{port}  -> {log_path.relative_to(REPO_ROOT)}")

    print(f"\n{len(processes)} services starting. Gateway: http://127.0.0.1:8000/docs")
    print("Ctrl-C to stop them all.\n")

    def shutdown(*_: object) -> None:
        for name, process, _log in processes:
            if process.poll() is None:
                process.terminate()
        for _name, process, _log in processes:
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
        print("\nall services stopped")
        raise SystemExit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        while True:
            time.sleep(1)
            for name, process, log_path in processes:
                if process.poll() is not None:
                    # A service that dies silently is worse than one that dies loudly.
                    print(f"\n{name} exited with code {process.returncode}; last lines:")
                    tail = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
                    print("\n".join(f"    {line}" for line in tail[-15:]))
                    shutdown()
    except KeyboardInterrupt:
        shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
