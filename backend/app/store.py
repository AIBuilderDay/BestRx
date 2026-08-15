"""The order store.

A long-running container can hold state in memory, so it does. Orders and events are seeded from
the JSON fixtures at startup and mutated in place; nothing here is persisted.

That is a deliberate trade for a demo: no database to provision, no seeding step, and a restart
returns the dataset to a known-good state. The cost is that writes do not survive a restart, which
is stated plainly in the README rather than hidden.

`subscribe()` is what makes SSE work without polling. A status change appends an event and hands it
straight to every connected client's queue, so latency is a function of the network rather than a
poll interval.
"""

from __future__ import annotations

import asyncio
import threading
from typing import Any

from .fixtures import seed_order_events, seed_orders

Row = dict[str, Any]

# How many events a slow client may fall behind before we start dropping. A browser that cannot
# keep up with this is not going to catch up, and an unbounded queue would grow until the process
# died.
SUBSCRIBER_QUEUE_SIZE = 100


class OrderStore:
    """Orders, their timeline, and the fan-out to connected SSE clients."""

    def __init__(self) -> None:
        # Guards the dicts below. Event fan-out happens on the asyncio loop, but writes arrive from
        # whichever worker thread FastAPI ran the handler on.
        self._lock = threading.Lock()

        self._orders: dict[str, Row] = {row["id"]: dict(row) for row in seed_orders()}

        # Seeded in timeline order so `seq` agrees with the order things actually happened in.
        self._events: list[Row] = []
        for index, row in enumerate(
            sorted(seed_order_events(), key=lambda event: event.get("at", "")), start=1
        ):
            self._events.append({**row, "seq": index})
        self._next_seq = len(self._events) + 1

        self._subscribers: set[asyncio.Queue[Row]] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Remember the loop, so a write from a worker thread can reach subscriber queues."""
        self._loop = loop

    # ── Orders ────────────────────────────────────────────────────────────────

    def list_orders(self) -> list[Row]:
        with self._lock:
            return [dict(order) for order in self._orders.values()]

    def get_order(self, order_id: str) -> Row | None:
        """None for a missing id, never a raise — matches the rule in docs/DATA_MODEL.md."""
        with self._lock:
            order = self._orders.get(order_id)
            return dict(order) if order else None

    def put_order(self, order: Row) -> None:
        with self._lock:
            self._orders[order["id"]] = dict(order)

    def next_order_id(self) -> str:
        """Continue the DME-##### series the fixtures use."""
        with self._lock:
            highest = 0
            for raw_id in self._orders:
                if raw_id.startswith("DME-") and raw_id[4:].isdigit():
                    highest = max(highest, int(raw_id[4:]))
        return f"DME-{max(highest, 10000) + 1}"

    # ── Events ────────────────────────────────────────────────────────────────

    def events_for_order(self, order_id: str) -> list[Row]:
        with self._lock:
            matches = [dict(e) for e in self._events if e.get("orderId") == order_id]
        return sorted(matches, key=lambda event: event.get("at", ""))

    def all_events(self) -> list[Row]:
        """Every event, oldest first. Feeds the frontend's boot snapshot in one request."""
        with self._lock:
            events = [dict(e) for e in self._events]
        return sorted(events, key=lambda event: event.get("at", ""))

    def events_since(self, seq: int, limit: int = 100) -> list[Row]:
        """Backfill for a client that reconnects with a cursor."""
        with self._lock:
            newer = [dict(e) for e in self._events if e.get("seq", 0) > seq]
        newer.sort(key=lambda event: event.get("seq", 0))
        return newer[:limit]

    def append_event(self, event: Row) -> Row:
        """Record an event and push it to every connected client."""
        with self._lock:
            stored = {**event, "seq": self._next_seq}
            self._next_seq += 1
            self._events.append(stored)

        self._publish(stored)
        return dict(stored)

    # ── SSE fan-out ───────────────────────────────────────────────────────────

    def subscribe(self) -> asyncio.Queue[Row]:
        queue: asyncio.Queue[Row] = asyncio.Queue(maxsize=SUBSCRIBER_QUEUE_SIZE)
        with self._lock:
            self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[Row]) -> None:
        with self._lock:
            self._subscribers.discard(queue)

    @property
    def subscriber_count(self) -> int:
        with self._lock:
            return len(self._subscribers)

    def _publish(self, event: Row) -> None:
        with self._lock:
            queues = list(self._subscribers)
        if not queues:
            return

        loop = self._loop
        if loop is None or loop.is_closed():
            # No loop bound yet: a write outside a request, or a test. Events are still recorded.
            return

        def deliver() -> None:
            for queue in queues:
                try:
                    queue.put_nowait(dict(event))
                except asyncio.QueueFull:
                    # Drop rather than block. A client this far behind will resync on reconnect
                    # using Last-Event-ID.
                    pass

        # The handler may be on a worker thread; queue mutation has to happen on the loop.
        try:
            loop.call_soon_threadsafe(deliver)
        except RuntimeError:
            pass


_store: OrderStore | None = None
_store_lock = threading.Lock()


def get_store() -> OrderStore:
    """One store per process."""
    global _store
    if _store is None:
        with _store_lock:
            if _store is None:
                _store = OrderStore()
    return _store


def reset_store() -> None:
    """Drop the store so the fixtures reload. Used by tests."""
    global _store
    with _store_lock:
        _store = None
