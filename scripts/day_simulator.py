"""Play out a resort day against the running system.

This is not seed data. It drives the real HTTP API the way people and phones would, so
every event, task, stock deduction and action card is produced by the product itself.
Point it at a running stack and watch the dashboard fill up.

    python scripts/day_simulator.py                 # a full day, a few minutes
    python scripts/day_simulator.py --speed 20      # faster
    python scripts/day_simulator.py --until 12:00   # stop at midday
    python scripts/day_simulator.py --dry-run       # print the schedule, touch nothing

It is deliberately honest about failure: if a step is refused, it says which step and
why and keeps going, because a demo that dies silently at 09:30 is worse than one that
says "the kitchen could not accept that order".

One thing it cannot do: the times in the left-hand column are the *story's* clock, not
the server's. The backend stamps everything with real wall-clock time, so a shift
check-in narrated at 07:00 is judged late or early against whatever time it actually is.
Moving the server's clock is the only way to change that, and faking it inside the
product to make a demo look tidier would be a worse trade than the odd odd-looking
"late by" figure.
"""
from __future__ import annotations

import argparse
import random
import sys
import time
from dataclasses import dataclass, field
from datetime import time as clock_time
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py-common"))

import httpx  # noqa: E402

# The backend, which is the whole API now that there is no proxy in front of it.
DEFAULT_API = "http://127.0.0.1:8000"
PASSWORD = "vesper123"

# Who does what. Each step runs as the person who would really do it, so permissions are
# exercised rather than bypassed by a superuser token.
ACTORS = {
    "gm": "gm@vesper.demo",
    "front_office": "fom@vesper.demo",
    "housekeeping": "exec@vesper.demo",
    "fnb": "chef@vesper.demo",
    "cook": "fnb1@vesper.demo",
    "maintenance": "chiefeng@vesper.demo",
    "housekeeper": "hk1@vesper.demo",
}

GUEST_NOTES = [
    "No mayo please",
    "Extra napkins",
    "Leave it at the door",
    "As soon as possible, thanks",
    "",
]
COMPLAINTS = [
    ("The room was not clean when we arrived", 2),
    ("Waited 40 minutes for breakfast, not great", 2),
    ("AC is noisy and the room is too warm", 2),
]
PRAISE = [
    ("Excellent service, very friendly staff", 5),
    ("The room was spotless and the food was delicious", 5),
    ("Quick and polite, thank you", 4),
]


class Failure(Exception):
    """A step the system refused. Reported, not fatal."""


@dataclass
class Clock:
    """Maps simulated resort time onto wall-clock seconds."""

    speed: float
    start_minute: int = 6 * 60
    end_minute: int = 23 * 60
    current: int = field(init=False)

    def __post_init__(self) -> None:
        self.current = self.start_minute

    def advance_to(self, minute: int) -> None:
        if minute <= self.current:
            return
        # One simulated minute costs 60/speed real seconds.
        delay = (minute - self.current) * (60.0 / self.speed)
        if delay > 0:
            time.sleep(min(delay, 5.0))  # never stall the demo for more than 5s a step
        self.current = minute

    @staticmethod
    def label(minute: int) -> str:
        return f"{minute // 60:02d}:{minute % 60:02d}"


class Resort:
    """A thin client over the API, holding one token per actor."""

    def __init__(self, api: str, timeout: float = 30.0) -> None:
        self.api = api.rstrip("/")
        self.http = httpx.Client(timeout=timeout)
        self.tokens: dict[str, str] = {}
        self.guest_tokens: dict[str, str] = {}

    def close(self) -> None:
        self.http.close()

    def sign_in(self, actor: str) -> str:
        if actor in self.tokens:
            return self.tokens[actor]
        email = ACTORS[actor]
        data = self.post("/auth/login", {"email": email, "password": PASSWORD})
        self.tokens[actor] = data["access_token"]
        return self.tokens[actor]

    def _request(self, method: str, path: str, *, token: str | None, json: Any = None, params: Any = None) -> Any:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        try:
            response = self.http.request(
                method, f"{self.api}{path}", headers=headers, json=json, params=params
            )
        except httpx.HTTPError as exc:
            raise Failure(f"could not reach {path}: {exc}") from exc
        if response.status_code >= 400:
            body = response.json() if response.content else {}
            message = (body.get("error") or {}).get("message", response.text[:120])
            raise Failure(f"{method} {path} -> {response.status_code}: {message}")
        return response.json() if response.content else None

    def get(self, path: str, token: str | None = None, **params: Any) -> Any:
        return self._request("GET", path, token=token, params=params or None)

    def post(self, path: str, json: Any = None, token: str | None = None) -> Any:
        return self._request("POST", path, token=token, json=json)

    def put(self, path: str, json: Any = None, token: str | None = None) -> Any:
        return self._request("PUT", path, token=token, json=json)

    def guest_session(self, property_id: str, room: dict) -> str:
        """Scan a room's QR the way a guest's phone would."""
        secret = self.get(f"/rooms/{room['id']}/qr", self.sign_in("front_office"))["qr_secret"]
        session = self.post(
            "/guest/session",
            {"property_id": property_id, "room_id": room["id"], "qr_secret": secret},
        )
        self.guest_tokens[room["id"]] = session["token"]
        return session["token"]


class Simulation:
    def __init__(self, resort: Resort, clock: Clock, *, dry_run: bool, seed: int) -> None:
        self.resort = resort
        self.clock = clock
        self.dry_run = dry_run
        self.random = random.Random(seed)
        self.property_id: str = ""
        self.occupied: list[dict] = []
        self.menu: list[dict] = []
        self.done = 0
        self.failed = 0

    # --- narration ----------------------------------------------------------------

    def say(self, minute: int, text: str) -> None:
        print(f"  {Clock.label(minute)}  {text}", flush=True)

    def step(self, minute: int, headline: str, action) -> None:
        self.clock.advance_to(minute)
        if self.dry_run:
            self.say(minute, headline)
            return
        try:
            detail = action()
        except Failure as exc:
            self.failed += 1
            self.say(minute, f"{headline}\n           ...refused: {exc}")
        else:
            self.done += 1
            self.say(minute, headline + (f" — {detail}" if detail else ""))

    # --- setup --------------------------------------------------------------------

    def prepare(self) -> None:
        token = self.resort.sign_in("gm")
        self.property_id = self.resort.get("/property", token)["id"]
        self.occupied = self.resort.get("/rooms", token, status="occupied")
        menu = self.resort.get("/guest/menu", self.guest_token_for(self.occupied[0]))
        self.menu = [item for items in menu["categories"].values() for item in items]
        if not self.occupied:
            raise SystemExit("no occupied rooms — run scripts/seed.py first")

    def guest_token_for(self, room: dict) -> str:
        cached = self.resort.guest_tokens.get(room["id"])
        return cached or self.resort.guest_session(self.property_id, room)

    # --- the day ------------------------------------------------------------------

    def run(self, until_minute: int) -> None:
        for minute, headline, action in self.schedule():
            if minute > until_minute:
                break
            self.step(minute, headline, action)

    def schedule(self) -> list[tuple[int, str, Any]]:
        r = self.random
        rooms = r.sample(self.occupied, k=min(8, len(self.occupied)))
        breakfast = [i for i in self.menu if i["category"] == "Breakfast"] or self.menu
        allday = [i for i in self.menu if i["category"] == "All Day"] or self.menu

        return [
            (7 * 60, "Housekeepers check in for the morning shift", self.check_in_staff),
            (7 * 60 + 30, "Night's dirty rooms go onto the housekeeping board", self.show_board),
            (
                9 * 60 + 30,
                f"Room {rooms[0]['number']} orders breakfast by QR",
                lambda: self.guest_orders(rooms[0], r.choice(breakfast), 2),
            ),
            (9 * 60 + 40, "F&B accepts and delivers it", self.fnb_delivers),
            (9 * 60 + 45, "Stock deducts itself from the recipe", self.show_stock),
            (
                10 * 60 + 15,
                f"Room {rooms[1]['number']} asks for fresh towels",
                lambda: self.guest_requests(rooms[1], "amenities", "Two extra towels please"),
            ),
            (11 * 60, "A housekeeper starts cleaning a checked-out room", self.clean_a_room),
            (
                12 * 60,
                "Maintenance sweeps the sensors for failing equipment",
                self.assess_assets,
            ),
            (
                13 * 60,
                f"Room {rooms[2]['number']} orders lunch",
                lambda: self.guest_orders(rooms[2], r.choice(allday), 1),
            ),
            (14 * 60, "A housekeeper reports a broken AC with a photo", self.report_issue),
            (15 * 60, "The demand forecast is refitted for the next 30 nights", self.refit_forecast),
            (15 * 60 + 30, "Rate cards are proposed from the fresh forecast", self.propose_rates),
            (16 * 60, "A request crosses its SLA and the manager is alerted", self.sweep_overdue),
            (
                19 * 60,
                f"Room {rooms[3]['number']} orders dinner and rates it",
                lambda: self.order_and_rate(rooms[3], r.choice(allday)),
            ),
            (20 * 60, "A guest asks the concierge a question", self.ask_concierge),
            (21 * 60, "An unhappy guest leaves a complaint", self.leave_complaint),
            (22 * 60, "The owner opens the dashboard", self.show_dashboard),
        ]

    # --- steps --------------------------------------------------------------------

    def check_in_staff(self) -> str:
        token = self.resort.sign_in("housekeeper")
        try:
            record = self.resort.post("/attendance/check-in", {"method": "qr"}, token)
            return f"late by {record['late_by_minutes']}min" if record["is_late"] else "on time"
        except Failure as exc:
            if "already checked in" in str(exc):
                return "already on shift"
            raise

    def show_board(self) -> str:
        board = self.resort.get("/rooms/board", self.resort.sign_in("housekeeping"))
        counts = {k: v for k, v in board["counts"].items() if v}
        return ", ".join(f"{v} {k}" for k, v in counts.items())

    def place_order(self, room: dict, item: dict, quantity: int) -> dict:
        return self.resort.post(
            "/guest/requests",
            {
                "kind": "room_service",
                "note": self.random.choice(GUEST_NOTES),
                "items": [{"menu_item_id": item["id"], "quantity": quantity}],
            },
            self.guest_token_for(room),
        )

    def guest_orders(self, room: dict, item: dict, quantity: int) -> str:
        request = self.place_order(room, item, quantity)
        return (
            f"{quantity}x {item['name']}, Rs {float(request['total_amount']):.0f}, "
            f"SLA {request['sla_minutes']}min"
        )

    def guest_requests(self, room: dict, kind: str, note: str) -> str:
        self.resort.post(
            "/guest/requests", {"kind": kind, "note": note, "items": []}, self.guest_token_for(room)
        )
        return "routed to housekeeping"

    def fnb_delivers(self, request_id: str | None = None) -> str:
        return self.deliver("fnb", request_id)

    def deliver(self, actor: str, request_id: str | None = None) -> str:
        """Work a task off the queue as the department that actually owns it.

        The actor matters as much as the request id: a towel request routes to
        housekeeping, so sending the F&B manager to fulfil it finds nothing — their task
        list only contains their own department's work. That is the permission model
        doing its job, not a bug to work around.
        """
        token = self.resort.sign_in(actor)
        tasks = self.resort.get("/tasks", token)["tasks"]
        pending = [t for t in tasks if t["source"] == "guest_request" and t["status"] != "done"]
        if request_id:
            pending = [t for t in pending if t["source_ref"] == request_id]
        if not pending:
            return "nothing waiting"
        task = pending[0]
        staff_actor = {"fnb": "cook", "housekeeping": "housekeeper"}.get(actor)
        if staff_actor is None:
            raise ValueError(f"No demo staff assignee configured for {actor}")
        staff_token = self.resort.sign_in(staff_actor)
        staff_id = self.resort.get("/auth/me", staff_token)["id"]
        self.resort.put(f"/tasks/{task['id']}/assignee", {"assignee_id": staff_id}, token)
        self.resort.put(f"/tasks/{task['id']}/status", {"status": "in_progress"}, staff_token)
        self.resort.put(f"/tasks/{task['id']}/status", {"status": "done"}, staff_token)
        return task["title"]

    def show_stock(self) -> str:
        items = self.resort.get("/inventory/items", self.resort.sign_in("fnb"), search="bread")
        return ", ".join(f"{i['name']} {float(i['quantity']):g}{i['unit'][:1]}" for i in items)

    def clean_a_room(self) -> str:
        token = self.resort.sign_in("housekeeper")
        dirty = self.resort.get("/rooms", token, status="dirty")
        if not dirty:
            return "no dirty rooms"
        room = dirty[0]
        self.resort.put(f"/rooms/{room['id']}/status", {"status": "cleaning"}, token)
        self.resort.put(f"/rooms/{room['id']}/status", {"status": "ready"}, token)
        return f"room {room['number']} is ready again"

    def assess_assets(self) -> str:
        result = self.resort.post("/maintenance/assess", None, self.resort.sign_in("maintenance"))
        return f"{result['assessed']} assets, {result['at_risk']} above the risk threshold"

    def report_issue(self) -> str:
        token = self.resort.sign_in("housekeeper")
        rooms = self.resort.get("/rooms", token, status="occupied")
        issue = self.resort.post(
            "/issues",
            {
                "summary": "AC not cooling",
                "description": "Blowing warm air, guest has complained",
                "category": "hvac",
                "severity": "high",
                "room_id": rooms[0]["id"],
            },
            token,
        )
        return "merged into an existing report" if issue["status"] == "merged" else "new work item"

    def refit_forecast(self) -> str:
        nights = self.resort.post(
            "/revenue/forecast/refresh?days=30", None, self.resort.sign_in("gm")
        )
        occupancy = sum(n["predicted_occupancy"] for n in nights) / max(len(nights), 1)
        return f"{len(nights)} nights, mean {occupancy:.0%}, model={nights[0]['model_name']}"

    def propose_rates(self) -> str:
        result = self.resort.post("/revenue/cards/propose?days=14", None, self.resort.sign_in("gm"))
        return f"{result['cards_raised']} rate card(s) in the queue"

    def sweep_overdue(self) -> str:
        result = self.resort.post(
            "/requests/sweep-overdue", None, self.resort.sign_in("front_office")
        )
        return f"{result['alerted']} overdue request(s) alerted"

    def order_and_rate(self, room: dict, item: dict) -> str:
        token = self.guest_token_for(room)
        request = self.place_order(room, item, 1)
        self.fnb_delivers(request["id"])
        comment, stars = self.random.choice(PRAISE)
        return self.rate(token, request["id"], comment, stars)

    def rate(self, token: str, request_id: str, comment: str, stars: int) -> str:
        """Rate one specific request, once it is actually delivered.

        The wait is the point rather than a workaround. Marking the task done publishes
        an event; the guest module consumes it and moves the guest's tracker to delivered.
        That hop is deliberately asynchronous, so a guest rating the instant the waiter
        taps "done" is racing the bus. A real guest rates the food after it arrives.
        """
        target = self.await_status(token, request_id, "delivered")
        if target is None:
            return "that request vanished"
        if target["status"] != "delivered":
            return f"not rated — still {target['status']}"
        if target["rating"] is not None:
            return "already rated"
        self.resort.post(
            f"/guest/requests/{request_id}/rating", {"rating": stars, "comment": comment}, token
        )
        return f"{stars} stars: “{comment}”"

    def ask_concierge(self) -> str:
        token = self.guest_token_for(self.occupied[0])
        answer = self.resort.post(
            "/guest-intel/concierge/ask", {"question": "What time does the spa close?"}, token
        )
        sources = len(answer["sources"])
        tail = "escalated to the front desk" if answer["escalated"] else f"{sources} source(s)"
        return f"{answer['answer'][:90]}... [{tail}]"

    def leave_complaint(self) -> str:
        """An unhappy guest, end to end: request, service, then a bad rating.

        The rating is what feeds the sentiment model and the department trend, so the
        request has to genuinely reach "delivered" first.
        """
        room = self.occupied[1]
        token = self.guest_token_for(room)
        request = self.resort.post(
            "/guest/requests",
            {"kind": "housekeeping", "note": "Room needs attention", "items": []},
            token,
        )
        # Housekeeping owns this one, so housekeeping closes it.
        self.deliver("housekeeping", request["id"])
        comment, stars = self.random.choice(COMPLAINTS)
        outcome = self.rate(token, request["id"], comment, stars)
        return f"{outcome} — sentiment scored, department flagged"

    def await_status(
        self, token: str, request_id: str, wanted: str, *, timeout: float = 10.0
    ) -> dict | None:
        """Poll the guest's own tracker until the request reaches `wanted`.

        Returns the last state seen either way, so the caller can report what it actually
        found rather than pretending it succeeded.
        """
        deadline = time.monotonic() + timeout
        target: dict | None = None
        while True:
            requests = self.resort.get("/guest/requests", token)
            target = next((r for r in requests if r["id"] == request_id), None)
            if target is None or target["status"] == wanted:
                return target
            if time.monotonic() >= deadline:
                return target
            time.sleep(0.5)

    def show_dashboard(self) -> str:
        data = self.resort.get("/dashboard", self.resort.sign_in("gm"))
        occupancy = (data.get("occupancy") or {}).get("occupancy_rate", 0)
        queue = (data.get("action_queue") or {}).get("pending_cards", 0)
        requests = (data.get("requests") or {}).get("open", 0)
        unavailable = data.get("unavailable") or []
        line = f"occupancy {occupancy:.0%}, {queue} cards pending, {requests} open requests"
        return line + (f" (unavailable: {', '.join(unavailable)})" if unavailable else "")


def parse_clock(value: str) -> int:
    try:
        parsed = clock_time.fromisoformat(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"expected HH:MM, got {value!r}") from None
    return parsed.hour * 60 + parsed.minute


def main() -> int:
    parser = argparse.ArgumentParser(description="Play out a resort day against a running stack")
    # --gateway is kept as an alias: it is what this flag was called for thirteen
    # services, and breaking a demo command to rename a flag is a poor trade.
    parser.add_argument("--api", "--gateway", dest="api", default=DEFAULT_API)
    parser.add_argument(
        "--speed", type=float, default=60.0, help="Simulated minutes per real second"
    )
    parser.add_argument("--until", type=parse_clock, default=23 * 60, help="Stop at HH:MM")
    parser.add_argument("--seed", type=int, default=7, help="Fixed so the demo repeats")
    parser.add_argument("--dry-run", action="store_true", help="Print the schedule only")
    args = parser.parse_args()

    resort = Resort(args.api)
    simulation = Simulation(
        resort, Clock(speed=args.speed), dry_run=args.dry_run, seed=args.seed
    )

    print(f"\nVesper — a day at the resort  ({args.api})\n")
    try:
        if not args.dry_run:
            simulation.prepare()
        else:
            print("  dry run: nothing will be sent\n")
            simulation.occupied = [{"id": "-", "number": "***"}] * 8
        simulation.run(args.until)
    except Failure as exc:
        print(f"\ncould not start: {exc}")
        print("is the stack running? try: python scripts/run_local.py")
        return 1
    finally:
        resort.close()

    if not args.dry_run:
        print(f"\n  {simulation.done} step(s) completed, {simulation.failed} refused")
    return 1 if simulation.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
