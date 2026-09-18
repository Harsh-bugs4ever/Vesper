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
from typing import Any
from uuid import UUID

import httpx

from .config import settings
from .permissions import ALL_PERMISSIONS
from .security import _encode

log = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(5.0, connect=2.0)


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
    """One configured base URL plus auth. Built per call site, not per request."""

    def __init__(self, base_url: str, *, name: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.name = name

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
            response = httpx.get(
                url, headers=self._headers(property_id, token), params=params, timeout=TIMEOUT
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
            response = httpx.post(
                url, headers=self._headers(property_id, token), json=json, timeout=TIMEOUT
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
