"""Work that runs without a request behind it.

Two kinds, started together at boot and covered in their own modules:

  * `event_bus` — the Redis consumers. Every cross-module fact still travels as an
    event, exactly as it did between containers.
  * `ai_workers` — the periodic jobs, including the engines that compute on a
    schedule rather than on request.
"""
from . import ai_workers, event_bus

__all__ = ["ai_workers", "event_bus"]
