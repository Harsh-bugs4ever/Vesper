"""Every request and response model, in one namespace.

The Pydantic models stay in the module that owns them — `app.api.inventory.schemas`
defines what an inventory response looks like, and that is where you change it.
This package re-exports them all under one import so a caller that spans modules
(the contract export, a test, a handler that quotes another module's shape) has a
single place to reach for.

Names are unchanged from the micro-service layout. The frontend builds against the
generated OpenAPI schema, where these names appear verbatim, so renaming one here
would rename it in the client the frontend is generated from.

    from app.schemas import inventory, frontdesk
    from app.schemas.identity import TokenPair
"""
from app.api.action import schemas as action
from app.api.frontdesk import schemas as frontdesk
from app.api.guest import schemas as guest
from app.api.guest_intel import schemas as guest_intel
from app.api.identity import schemas as identity
from app.api.inventory import schemas as inventory
from app.api.maintenance import schemas as maintenance
from app.api.notification import schemas as notification
from app.api.property import schemas as property
from app.api.revenue import schemas as revenue
from app.api.staff import schemas as staff
from app.api.workforce import schemas as workforce

__all__ = [
    "action", "frontdesk", "guest", "guest_intel", "identity", "inventory",
    "maintenance", "notification", "property", "revenue", "staff", "workforce",
]
