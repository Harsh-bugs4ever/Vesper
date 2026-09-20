"""Service-to-service HTTP.

Services never read each other's tables. When guest-service needs to know whether room
412 is occupied, it asks front desk over HTTP with a short-lived service token rather
than reaching into the frontdesk schema.

Every call has a timeout and a documented failure mode: a helper either returns None and
lets the caller degrade, or raises so the request fails loudly. Silent empty results are
worse than either.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from threading import Lock
from typing import Any
from uuid import UUID

import httpx

from .config import settings
from .permissions import ALL_PERMISSIONS
from .security import _encode

log = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(5.0, connect=2.0)

# Normally every ServiceClient opens a real socket. When the whole backend runs as one
# process there is nothing on the other end of that socket but ourselves, so the entry
# point installs a transport that dispatches straight into the ASGI app instead — see
# app/transport.py. Nothing else about a call changes: the same URL is built, the same
# middleware and dependencies run, the same status code comes back.
_shared_transport: httpx.BaseTransport | None = None


def use_transport(transport: httpx.BaseTransport | None) -> None:
    """Route every client through `transport`. Call before the first request."""
    global _shared_transport
    _shared_transport = transport
    for client in _registry:
        client.close()  # drop any pooled client built against the old transport


# Every ServiceClient ever built, so use_transport reaches the ones created at import.
_registry: list["ServiceClient"] = []


def service_token(property_id: str | UUID, *, permissions: list[str] | None = None) -> str:
    """A machine principal.

    Scoped to one property and, by default, to every permission — an internal caller has
    already had the human's permission checked at the edge it came in through.
    """
    return _encode(
        {
            "sub": f"service:{settings.service_name}",
            "typ": "access",
            "pid": str(property_id),
            "role": "service",
            "dept": None,
            "perms": permissions if permissions is not None else ALL_PERMISSIONS,
        },
        timedelta(minutes=5),
    )


class ServiceClient:
    """One configured base URL plus auth. Built per call site, not per request.

    Each client keeps a pooled httpx.Client. The module-level `httpx.get` helpers open a
    brand-new TCP connection for every call and close it afterwards, which is invisible
    on a handful of requests and ruinous on a loop: the maintenance sweep makes one call
    per asset, and paying full connection setup twelve times took it past its timeout.
    Reusing connections turned that from tens of seconds into about one.
    """

    def __init__(self, base_url: str, *, name: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.name = name
        self._client: httpx.Client | None = None
        self._lock = Lock()
        _registry.append(self)

    @property
    def client(self) -> httpx.Client:
        """Built on first use so importing this module opens no sockets."""
        if self._client is None:
            with self._lock:
                if self._client is None:
                    self._client = httpx.Client(
                        timeout=TIMEOUT,
                        limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
                        transport=_shared_transport,
                    )
        return self._client

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    def _headers(self, property_id: str | UUID, token: str | None) -> dict[str, str]:
        return {"Authorization": f"Bearer {token or service_token(property_id)}"}

    def get(
        self,
        path: str,
        *,
        property_id: str | UUID,
        token: str | None = None,
        params: dict | None = None,
    ) -> Any | None:
        """Returns None when the peer is unreachable or answers 4xx/5xx.

        Callers decide what a missing answer means: the dashboard shows a dash, the
        request path refuses to continue.
        """
        url = f"{self.base_url}{path}"
        try:
            response = self.client.get(
                url, headers=self._headers(property_id, token), params=params
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            log.warning("GET %s failed: %s", url, exc)
            return None

    def post(
        self,
        path: str,
        *,
        property_id: str | UUID,
        json: dict | list | None = None,
        token: str | None = None,
    ) -> Any | None:
        url = f"{self.base_url}{path}"
        try:
            response = self.client.post(
                url, headers=self._headers(property_id, token), json=json
            )
            response.raise_for_status()
            return response.json() if response.content else {}
        except httpx.HTTPError as exc:
            log.warning("POST %s failed: %s", url, exc)
            return None


identity = ServiceClient(settings.identity_url, name="identity")
property_client = ServiceClient(settings.property_url, name="property")
staff = ServiceClient(settings.staff_url, name="staff")
guest = ServiceClient(settings.guest_url, name="guest")
inventory = ServiceClient(settings.inventory_url, name="inventory")
frontdesk = ServiceClient(settings.frontdesk_url, name="frontdesk")
action = ServiceClient(settings.action_url, name="action")
revenue = ServiceClient(settings.revenue_url, name="revenue")
maintenance = ServiceClient(settings.maintenance_url, name="maintenance")
workforce = ServiceClient(settings.workforce_url, name="workforce")
guest_intel = ServiceClient(settings.guest_intel_url, name="guest-intel")
notification = ServiceClient(settings.notification_url, name="notification")
