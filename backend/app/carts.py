"""The cart store.

One open cart per user, held in this process's memory alongside the orders in `store.py` and with
the same trade: no database to provision, and a restart returns to an empty cart. Carts are
short-lived by nature — a nurse fills one and checks out in the same session — so losing them on a
restart costs far less than losing orders would.

A cart is server-authoritative: the frontend sends the lines it wants and gets back the cart the
server actually stored. That way two tabs, or a refresh mid-order, can never disagree about what is
about to be ordered.
"""

from __future__ import annotations

import threading
from typing import Any

Row = dict[str, Any]

# Matches the frontend's per-line clamp in lib/catalog.ts, so a quantity cannot mean one thing in
# the drawer and another in the stored cart.
MAX_LINE_QTY = 99


class CartStore:
    """Carts keyed by user id. One open cart per user."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._carts: dict[str, Row] = {}
        self._counter = 0

    def get(self, user_id: str) -> Row | None:
        """None when the user has no cart yet — never a raise, per docs/DATA_MODEL.md."""
        with self._lock:
            cart = self._carts.get(user_id)
            return _copy(cart) if cart else None

    def put(self, cart: Row) -> Row:
        with self._lock:
            self._carts[cart["userId"]] = _copy(cart)
            return _copy(cart)

    def delete(self, user_id: str) -> bool:
        with self._lock:
            return self._carts.pop(user_id, None) is not None

    def next_cart_id(self) -> str:
        with self._lock:
            self._counter += 1
            return f"CART-{self._counter:05d}"


def _copy(cart: Row) -> Row:
    """Deep enough for a cart: the only nested structure is the flat list of lines."""
    return {**cart, "lines": [dict(line) for line in cart.get("lines", [])]}


_store: CartStore | None = None
_store_lock = threading.Lock()


def get_cart_store() -> CartStore:
    """One store per process."""
    global _store
    if _store is None:
        with _store_lock:
            if _store is None:
                _store = CartStore()
    return _store


def reset_cart_store() -> None:
    """Drop the store so carts start empty. Used by tests."""
    global _store
    with _store_lock:
        _store = None
