"""Verify live seeded operations without resetting the demo database."""

import time
from uuid import uuid4

import psycopg
import requests
from seed import PASSWORD
from smoke_workflow import DB

BASE = "http://127.0.0.1:8000"


def call(method, path, *, token=None, expected=200, **kwargs):
    start = time.perf_counter()
    response = requests.request(method, BASE + path, headers={
        "Authorization": f"Bearer {token}"} if token else {}, timeout=30, **kwargs)
    elapsed = round((time.perf_counter() - start) * 1000)
    if response.status_code != expected:
        raise AssertionError(f"{method} {path}: {response.status_code} {response.text[:300]}")
    print(f"{method} {path}: {elapsed} ms")
    return response.json()


def login(email):
    return call("POST", "/auth/login", json={"email": email, "password": PASSWORD})["access_token"]


def main():
    gm = login("gm@vesper.demo")
    chef = login("chef@vesper.demo")
    cook = login("fnb1@vesper.demo")
    engineer = login("chiefeng@vesper.demo")
    with psycopg.connect(DB) as db:
        property_id, room_id, qr_secret = db.execute(
            "SELECT r.property_id,r.id,r.qr_secret FROM property.rooms r "
            "JOIN frontdesk.stays s ON s.room_id=r.id WHERE s.status='in_house' LIMIT 1"
        ).fetchone()
        fnb_id = db.execute(
            "SELECT id FROM property.departments WHERE property_id=%s AND key='fnb'",
            (property_id,),
        ).fetchone()[0]
    guest = call("POST", "/guest/session", json={
        "property_id": str(property_id), "room_id": str(room_id), "qr_secret": qr_secret,
    })["token"]
    call("GET", "/guest/room", token=guest)
    menu = call("GET", "/guest/menu", token=guest)
    call("GET", "/attendance/me", token=cook)
    call("GET", "/inventory/items", token=chef)
    call("GET", "/purchase-orders", token=chef)
    call("GET", "/dashboard/overview", token=gm)
    twin = call("GET", "/dashboard/digital-twin", token=gm,
                params={"department_id": str(fnb_id), "rain_delta_mm": 45, "heat_delta_c": 3})
    assert len(twin["days"]) == 14
    assert twin["summary"]["scenario"] == {"rain_delta_mm": 45.0, "heat_delta_c": 3.0}
    call("GET", "/cards", token=gm)

    with psycopg.connect(DB) as db:
        candidate = None
        for item in (item for category in menu["categories"].values() for item in category
                     if item["is_available"]):
            row = db.execute(
                "SELECT recipe FROM guest.menu_items WHERE id=%s", (item["id"],)
            ).fetchone()
            if row and row[0]:
                candidate = item
                recipe = row[0]
                break
        assert candidate, "No available menu item has a recipe"
        stock_id = next(iter(recipe))
        before = db.execute(
            "SELECT quantity FROM inventory.stock_items WHERE id=%s", (stock_id,)
        ).fetchone()[0]

    order = call("POST", "/guest/requests", token=guest, expected=201, json={
        "kind": "room_service", "note": f"Live workflow check {uuid4().hex[:8]}",
        "items": [{"menu_item_id": candidate["id"], "quantity": 1}],
    })
    assert order["status"] == "raised" and order["total_amount"] != 0
    task = None
    for _ in range(25):
        board = call("GET", "/tasks", token=cook)
        task = next((row for row in board["tasks"] if row.get("source_ref") == order["id"]), None)
        if task:
            break
        time.sleep(0.4)
    assert task, "Room-service order did not reach F&B"
    call("POST", f"/tasks/{task['id']}/claim", token=cook)
    call("PUT", f"/tasks/{task['id']}/status", token=cook, json={"status": "done"})
    for _ in range(25):
        with psycopg.connect(DB) as db:
            after = db.execute(
                "SELECT quantity FROM inventory.stock_items WHERE id=%s", (stock_id,)
            ).fetchone()[0]
        if after < before:
            break
        time.sleep(0.4)
    assert after < before, f"Recipe stock was not deducted: {before} -> {after}"
    assert any(row["id"] == order["id"] and row["status"] == "delivered"
               for row in call("GET", "/guest/requests", token=guest))
    call("POST", f"/guest/requests/{order['id']}/rating", token=guest,
         json={"rating": 5, "comment": "Live workflow check"})

    issue = call("POST", "/issues", token=engineer, expected=201, json={
        "summary": f"Live check AC fault {uuid4().hex[:8]}",
        "category": "air_conditioning", "severity": "normal", "room_id": str(room_id),
    })
    with psycopg.connect(DB) as db:
        linked = db.execute(
            "SELECT COALESCE(i.work_order_id, original.work_order_id) "
            "FROM guest.issue_reports i LEFT JOIN guest.issue_reports original "
            "ON original.id=i.merged_into_id WHERE i.id=%s", (issue["id"],)
        ).fetchone()
    assert linked and linked[0], "Issue or its merged owner has no linked maintenance work order"
    print(f"Live order, recipe stock deduction, guest rating, and issue work order passed")


if __name__ == "__main__":
    main()
