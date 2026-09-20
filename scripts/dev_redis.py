"""A stand-in Redis for laptops without one.

`docker compose up` brings a real Redis. This is for developing without Docker: it
speaks the Redis wire protocol over TCP, so the backend connects to it exactly as it
would to the real thing — streams, consumer groups, pub/sub and all.

Without it the backend still runs; it just loses the event bus, so nothing reacts to
anything else and the live feed stays empty.

It is in-memory and single-process. Everything vanishes when it stops, which is fine for
the event bus (events are transient) but means it is for development only.

    python scripts/dev_redis.py            # 127.0.0.1:6379
    python scripts/dev_redis.py --port 6380
"""
from __future__ import annotations

import argparse
import threading


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a development Redis")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=6379)
    args = parser.parse_args()

    try:
        from fakeredis import TcpFakeServer
    except ImportError:
        raise SystemExit(
            "fakeredis is not installed. Either `pip install fakeredis` or run a real "
            "Redis (docker compose up redis)."
        ) from None

    server = TcpFakeServer((args.host, args.port), server_type="redis")
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"development Redis on {args.host}:{args.port} — Ctrl-C to stop")
    print("in-memory and single-process; do not use for anything but development")

    try:
        thread.join()
    except KeyboardInterrupt:
        server.shutdown()
        print("\nstopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
