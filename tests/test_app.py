"""The monolith boots, and serves the URLs the frontends already call.

Deliberately shallow: these need no database and no Redis. They check the wiring
that the split into one process could plausibly have broken — that every module's
routes are mounted on the paths they were mounted on before, that authentication
is still enforced by the routes themselves now that there is no gateway in front
of them, and that the OpenAPI schema the frontend is generated from still builds.

Anything deeper belongs with the module that owns it.

The client is used without its context manager on purpose, so the lifespan hook
does not run: starting the Redis consumers and the scheduler threads is exactly
what a test of the route table should not do.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

# Every prefix the gateway used to route to, and the module that now owns it. If a
# path disappears here, a frontend page stops working.
EXPECTED_PREFIXES = [
    "/auth", "/admin",
    "/property", "/rooms", "/assets",
    "/attendance", "/tasks",
    "/guest", "/requests", "/issues", "/guests",
    "/inventory", "/purchase-orders",
    "/bookings", "/stays", "/visits",
    "/cards", "/dashboard", "/learning", "/audit",
    "/revenue", "/maintenance", "/workforce",
    "/guest-intel", "/guest-reviews", "/staff-reviews",
    "/notifications",
]


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="module")
def paths() -> set[str]:
    return {route.path for route in app.routes if hasattr(route, "path")}


@pytest.mark.parametrize("prefix", EXPECTED_PREFIXES)
def test_every_prefix_is_mounted(prefix: str, paths: set[str]):
    assert any(p == prefix or p.startswith(prefix + "/") for p in paths), (
        f"nothing is mounted at {prefix}; a frontend page calling it would 404"
    )


def test_the_live_socket_is_mounted(paths: set[str]):
    """The dashboard's live feed, which used to be bridged through the gateway."""
    assert "/live" in paths


def test_health_needs_nothing(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_a_protected_route_refuses_an_anonymous_caller(client: TestClient):
    """There is no gateway checking tokens at the edge any more; the route must."""
    response = client.get("/rooms")
    assert response.status_code == 401


def test_guest_cannot_enumerate_live_room_qr_secrets(client: TestClient, paths: set[str]):
    assert "/guest/active-rooms" not in paths
    assert client.get("/guest/active-rooms").status_code == 404


def test_a_protected_route_refuses_a_forged_token(client: TestClient):
    response = client.get("/rooms", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401


def test_the_openapi_schema_builds(client: TestClient):
    """One spec now, where there used to be thirteen. The frontend is generated from it."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema["paths"], "the schema describes no endpoints"
    assert "/auth/login" in schema["paths"]
