"""What an approved card actually does, and how to take it back.

Every card kind has an executor and a matching undo. The rule that makes undo safe: an
executor must capture the *current* state into `undo_payload` before it changes anything,
so revert restores what was really there rather than what the card assumed.

Shadow mode short-circuits every executor — the decision, the audit entry and the score
all still happen, but nothing outside Vesper moves.
"""
from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any
from uuid import UUID

from vesper_common.clients import inventory, revenue, workforce

log = logging.getLogger(__name__)

# Result shape every executor returns: what changed, plus what to restore on undo.
ExecResult = dict[str, Any]


class ExecutionFailed(Exception):
    """The downstream service refused or was unreachable. The card stays approved."""


def execute(kind: str, card, *, shadow: bool) -> ExecResult:
    handler = _EXECUTORS.get(kind)
    if handler is None:
        raise ExecutionFailed(f"No executor for card kind '{kind}'")
    if shadow:
        # Everything downstream of this point is a no-op, deliberately and visibly.
        return {"shadow": True, "would_have": card.payload, "undo": {}}
    return handler(card)


def undo(kind: str, card) -> ExecResult:
    handler = _UNDOERS.get(kind)
    if handler is None:
        raise ExecutionFailed(f"Card kind '{kind}' cannot be undone")
    if card.was_shadow:
        return {"shadow": True}
    return handler(card)


def _payload(card) -> dict:
    """The card's payload with the manager's adjustments applied on top.

    Adjust-then-approve must execute what the human saw in the modal, not what the
    engine originally proposed.
    """
    return {**card.payload, **(card.adjustments or {})}


# --- rate change ------------------------------------------------------------------


def _execute_rate(card) -> ExecResult:
    """Apply a per-date rate.

    Per-date, not a blanket override: the prototype bug was a single rate row that
    silently repriced every future date, which is why undo could not put it back.
    """
    data = _payload(card)
    result = revenue.post(
        "/revenue/rates/apply",
        property_id=card.property_id,
        json={
            "room_category_id": data["room_category_id"],
            "dates": data["dates"],
            "rate": data["rate"],
            "source_card_id": str(card.id),
        },
    )
    if result is None:
        raise ExecutionFailed("Revenue service did not accept the rate change")
    return {
        "applied": result,
        # The rates that were in place before, date by date.
        "undo": {"previous_rates": result.get("previous_rates", [])},
    }


def _undo_rate(card) -> ExecResult:
    previous = (card.undo_payload or {}).get("previous_rates") or []
    result = revenue.post(
        "/revenue/rates/restore",
        property_id=card.property_id,
        json={"previous_rates": previous, "source_card_id": str(card.id)},
    )
    if result is None:
        raise ExecutionFailed("Revenue service did not accept the revert")
    return {"restored": result}


# --- purchase ---------------------------------------------------------------------


def _execute_purchase(card) -> ExecResult:
    data = _payload(card)
    order_id = data["purchase_order_id"]
    body = {}
    if data.get("quantity") is not None:
        body["quantity"] = data["quantity"]
    result = inventory.post(
        f"/purchase-orders/{order_id}/approve", property_id=card.property_id, json=body
    )
    if result is None:
        raise ExecutionFailed("Inventory service did not accept the purchase approval")
    return {"approved": result, "undo": {"purchase_order_id": order_id}}


def _undo_purchase(card) -> ExecResult:
    order_id = (card.undo_payload or {}).get("purchase_order_id")
    if not order_id:
        raise ExecutionFailed("Nothing recorded to cancel")
    result = inventory.post(f"/purchase-orders/{order_id}/cancel", property_id=card.property_id)
    if result is None:
        raise ExecutionFailed("Inventory service did not accept the cancellation")
    return {"cancelled": result}


# --- roster -----------------------------------------------------------------------


def _execute_roster(card) -> ExecResult:
    data = _payload(card)
    result = workforce.post(
        "/workforce/roster/apply",
        property_id=card.property_id,
        json={"assignments": data.get("assignments", []), "source_card_id": str(card.id)},
    )
    if result is None:
        raise ExecutionFailed("Workforce service did not accept the roster change")
    return {"applied": result, "undo": {"previous": result.get("previous_assignments", [])}}


def _undo_roster(card) -> ExecResult:
    previous = (card.undo_payload or {}).get("previous") or []
    result = workforce.post(
        "/workforce/roster/apply",
        property_id=card.property_id,
        json={"assignments": previous, "source_card_id": str(card.id), "is_revert": True},
    )
    if result is None:
        raise ExecutionFailed("Workforce service did not accept the revert")
    return {"restored": result}


# --- work order and retention offer ------------------------------------------------


def _execute_via_event(card) -> ExecResult:
    """Work orders and retention offers become work for a human.

    There is nothing to call: service.py publishes CARD_EXECUTED with a task spec, and
    staff-service creates the task. Undo is cancelling that task.
    """
    return {"queued": _payload(card), "undo": {"card_id": str(card.id)}}


def _undo_via_event(card) -> ExecResult:
    # The compensating event is published by service.undo_card; nothing to call here.
    return {"cancelled": True}


_EXECUTORS: dict[str, Callable[[Any], ExecResult]] = {
    "rate_change": _execute_rate,
    "purchase": _execute_purchase,
    "roster_change": _execute_roster,
    "work_order": _execute_via_event,
    "retention_offer": _execute_via_event,
    "staffing_gap": _execute_via_event,
}

_UNDOERS: dict[str, Callable[[Any], ExecResult]] = {
    "rate_change": _undo_rate,
    "purchase": _undo_purchase,
    "roster_change": _undo_roster,
    "work_order": _undo_via_event,
    "retention_offer": _undo_via_event,
    "staffing_gap": _undo_via_event,
}
