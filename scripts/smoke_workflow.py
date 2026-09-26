"""Exercise the seeded guest-to-staff workflow against a running local stack.

Requires the disposable demo database, Redis, and the backend on localhost:8000.
Run after ``python scripts/seed.py``.
"""

import time

import psycopg
import requests


BASE = "http://127.0.0.1:8000"
DB = "postgresql://vesper:vesper@localhost:5432/vesper"


def call(method, path, *, token=None, expected=200, **kwargs):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    response = requests.request(method, BASE + path, headers=headers, timeout=15, **kwargs)
    if response.status_code != expected:
        raise AssertionError(f"{method} {path}: {response.status_code} {response.text[:500]}")
    return response.json()


def login(email):
    return call("POST", "/auth/login", json={"email": email, "password": "vesper123"})["access_token"]


def main():
    assert call("GET", "/ready")["ready"]
    owner = login("owner@vesper.demo")
    staff = login("hk1@vesper.demo")
    manager = login("exec@vesper.demo")
    staff_me = call("GET", "/auth/me", token=staff)
    department_id = staff_me["department_id"]

    with psycopg.connect(DB) as db:
        room = db.execute(
            "SELECT r.property_id, r.id, r.qr_secret FROM property.rooms r "
            "JOIN frontdesk.stays s ON s.room_id = r.id "
            "WHERE s.status = 'in_house' LIMIT 1"
        ).fetchone()
    assert room, "seed has no occupied room"
    property_id, room_id, qr_secret = map(str, room)

    session = call("POST", "/guest/session", json={
        "property_id": property_id, "room_id": room_id, "qr_secret": qr_secret,
    })
    guest = session["token"]
    call("GET", "/guest/room", token=guest)
    call("GET", "/guest/menu", token=guest)
    request = call("POST", "/guest/requests", token=guest, expected=201,
                   json={"kind": "housekeeping", "note": "Smoke test: fresh towels"})
    request_id = request["id"]
    print("guest request created", request_id)

    task = None
    for _ in range(20):
        board = call("GET", "/tasks", token=staff)
        task = next((t for t in board["tasks"] if t.get("source_ref") == request_id), None)
        if task:
            break
        time.sleep(0.5)
    assert task, "guest request did not reach the staff task pool"
    task_id = task["id"]
    claimed = call("POST", f"/tasks/{task_id}/claim", token=staff)
    assert claimed["status"] == "in_progress"
    call("PUT", f"/tasks/{task_id}/status", token=staff,
         json={"status": "done"})
    print("staff task completed", task_id)

    delivered = None
    for _ in range(20):
        requests = call("GET", "/guest/requests", token=guest)
        delivered = next((r for r in requests if r["id"] == request_id), None)
        if delivered and delivered["status"] == "delivered":
            break
        time.sleep(0.5)
    assert delivered and delivered["status"] == "delivered", "guest did not see delivery"
    call("POST", f"/guest/requests/{request_id}/rating", token=guest,
         json={"rating": 5, "comment": "Smoke test"})
    print("guest saw delivery and rated it")
    call("GET", "/tasks", token=owner)
    report = call("POST", "/reports", token=staff, expected=201, json={
        "department_id": department_id, "category": "general",
        "summary": "Smoke test housekeeping report",
    })
    print("staff report created", report["id"])
    call("GET", "/reports", token=manager)
    call("POST", f"/reports/{report['id']}/approve", token=manager)
    print("manager report approved")
    print("workflow passed")


if __name__ == "__main__":
    main()
