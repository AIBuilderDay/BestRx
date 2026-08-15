"""The order status lifecycle.

Mirrors `OrderStatus` in frontend/src/types/domain.ts. Two disjoint tracks: a delivery track and a
pickup track. Validating transitions here keeps a stray API call from producing a timeline that
contradicts itself — the timeline is the thing a case manager reads.
"""

from __future__ import annotations

DELIVERY_TRACK: tuple[str, ...] = ("ordered", "dispatched", "in_transit", "delivered")
PICKUP_TRACK: tuple[str, ...] = ("pickup_triggered", "picked_up")

ALL_STATUSES: tuple[str, ...] = DELIVERY_TRACK + PICKUP_TRACK

# Forward edges only. A delivered order is terminal; so is a picked-up one.
ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "ordered": frozenset({"dispatched"}),
    "dispatched": frozenset({"in_transit"}),
    "in_transit": frozenset({"delivered"}),
    "delivered": frozenset(),
    "pickup_triggered": frozenset({"picked_up"}),
    "picked_up": frozenset(),
}

# The timestamp field an arriving status stamps on the order, if any.
STATUS_TIMESTAMP_FIELD: dict[str, str] = {
    "delivered": "deliveredAt",
    "pickup_triggered": "pickupTriggeredAt",
    "picked_up": "pickedUpAt",
}


def is_known_status(status: str) -> bool:
    return status in ALL_STATUSES


def allowed_next(current: str) -> frozenset[str]:
    """Statuses reachable from `current`. Empty for a terminal or unknown status."""
    return ALLOWED_TRANSITIONS.get(current, frozenset())


def can_transition(current: str, target: str) -> bool:
    return target in allowed_next(current)


def describe(status: str, order_id: str) -> str:
    """A plain sentence for the event timeline and the push notification body."""
    sentences = {
        "ordered": f"Order {order_id} placed.",
        "dispatched": f"Order {order_id} dispatched from the vendor.",
        "in_transit": f"Order {order_id} is on the truck and en route.",
        "delivered": f"Order {order_id} delivered.",
        "pickup_triggered": f"Pickup requested for order {order_id}.",
        "picked_up": f"Equipment for order {order_id} picked up.",
    }
    return sentences.get(status, f"Order {order_id} moved to {status}.")
