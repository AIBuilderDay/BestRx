"""Order creation and status transitions.

`change_status` is the spine of the design: it validates, writes the order, appends the event that
feeds SSE, and enqueues the message that feeds push. Keeping it in one place means the two
notification channels can never disagree about what happened.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from ..config import Settings
from ..fixtures import find_by
from ..lifecycle import (
    STATUS_TIMESTAMP_FIELD,
    allowed_next,
    can_transition,
    describe,
    is_known_status,
)
from ..store import OrderStore
from . import notifications

Row = dict[str, Any]

# The dataset is Mountain time (see docs/DATA_MODEL.md), so new rows must use the same offset as the
# fixtures they sit alongside.
MOUNTAIN = timezone(timedelta(hours=-6))


class OrderNotFound(Exception):
    def __init__(self, order_id: str) -> None:
        super().__init__(f"Order {order_id} not found")
        self.order_id = order_id


class InvalidTransition(Exception):
    def __init__(self, order_id: str, current: str, target: str) -> None:
        super().__init__(f"Cannot move order {order_id} from {current} to {target}")
        self.order_id = order_id
        self.current = current
        self.target = target
        self.allowed = sorted(allowed_next(current))


class UnknownPatient(Exception):
    def __init__(self, patient_id: str) -> None:
        super().__init__(f"Patient {patient_id} not found")
        self.patient_id = patient_id


def now_iso() -> str:
    return datetime.now(MOUNTAIN).isoformat(timespec="seconds")


def _next_event_id(store: OrderStore, order_id: str) -> str:
    existing = len(store.events_for_order(order_id))
    return f"EVT-{order_id[4:]}-{existing + 1:03d}"


def list_orders(
    store: OrderStore,
    hospice_id: str | None = None,
    patient_id: str | None = None,
    status: str | None = None,
) -> list[Row]:
    orders = store.list_orders()
    if hospice_id:
        orders = [o for o in orders if o.get("hospiceId") == hospice_id]
    if patient_id:
        orders = [o for o in orders if o.get("patientId") == patient_id]
    if status:
        orders = [o for o in orders if o.get("status") == status]
    return sorted(orders, key=lambda order: str(order.get("orderedAt") or ""), reverse=True)


def get_order_with_timeline(store: OrderStore, order_id: str) -> tuple[Row, list[Row]]:
    order = store.get_order(order_id)
    if order is None:
        raise OrderNotFound(order_id)
    return order, store.events_for_order(order_id)


def create_order(store: OrderStore, settings: Settings, payload: Row) -> Row:
    """Create an order in `ordered` state and open its timeline."""
    patient_id = payload["patientId"]
    if find_by("patients", "id", patient_id) is None:
        raise UnknownPatient(patient_id)

    timestamp = now_iso()
    order_id = store.next_order_id()

    order: Row = {
        "id": order_id,
        # Only the six orders supplied by the organizers are canonical (docs/DATA_MODEL.md).
        "canonical": False,
        "status": "ordered",
        "riskState": None,
        "patientId": patient_id,
        "hospiceId": payload["hospiceId"],
        "vendorId": payload.get("vendorId"),
        "orderedById": payload.get("orderedById"),
        "orderType": payload.get("orderType", "routine"),
        "urgency": payload.get("urgency", "routine"),
        "equipment": payload["equipment"],
        "orderedAt": timestamp,
        "targetBy": payload.get("targetBy"),
        "eta": None,
        "notes": payload.get("notes", ""),
    }
    store.put_order(order)

    event = {
        "id": _next_event_id(store, order_id),
        "orderId": order_id,
        "at": timestamp,
        "event": "ordered",
        "actorId": payload.get("orderedById"),
        "detail": describe("ordered", order_id),
    }
    stored_event = store.append_event(event)

    notifications.publish_status_change(settings, order, stored_event)
    return order


def change_status(
    store: OrderStore,
    settings: Settings,
    order_id: str,
    target: str,
    actor_id: str | None = None,
    detail: str | None = None,
) -> tuple[Row, Row]:
    """Move an order to `target`, append its event, and enqueue a push.

    Appending the event fans it out to every connected SSE client; the enqueue hands it to the
    notification service. Returns the updated order and the event that was written.
    """
    order = store.get_order(order_id)
    if order is None:
        raise OrderNotFound(order_id)

    current = str(order.get("status", ""))
    if not is_known_status(target) or not can_transition(current, target):
        raise InvalidTransition(order_id, current, target)

    timestamp = now_iso()
    order["status"] = target

    stamp_field = STATUS_TIMESTAMP_FIELD.get(target)
    if stamp_field:
        order[stamp_field] = timestamp

    # A delivered order has arrived, so its ETA is no longer a prediction.
    if target == "delivered":
        order["eta"] = timestamp
        order["riskState"] = None

    store.put_order(order)

    event = {
        "id": _next_event_id(store, order_id),
        "orderId": order_id,
        "at": timestamp,
        "event": target,
        "actorId": actor_id,
        "detail": detail or describe(target, order_id),
    }
    stored_event = store.append_event(event)

    notifications.publish_status_change(settings, order, stored_event)
    return order, stored_event
