"""The twelve bounded contexts, each a package under this one.

Every module exposes the same small surface, which is all the entry point and the
background workers need to know about it:

    NAME                 what to call it in a log line
    routers              the APIRouters to mount, already carrying their own
                         prefixes (/auth, /rooms, /inventory, ...)
    start_subscriptions  optional; its Redis consumers
    build_scheduler      optional; its periodic jobs

Ordering below is the dependency order the system was built in — identity first,
the decision layer and the engines last — so a log of what started reads the way
the product does. Routes are mounted in this order too, though none of them
overlap, so it is for the docs page rather than for resolution.
"""
from . import (
    action,
    frontdesk,
    guest,
    guest_intel,
    identity,
    inventory,
    maintenance,
    notification,
    property,
    revenue,
    staff,
    workforce,
)

MODULES = (
    identity,
    property,
    staff,
    guest,
    inventory,
    frontdesk,
    action,
    revenue,
    maintenance,
    workforce,
    guest_intel,
    notification,
)

__all__ = ["MODULES"] + [m.__name__.rsplit(".", 1)[-1] for m in MODULES]
