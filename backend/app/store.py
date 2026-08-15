"""The order store.

Two implementations behind one interface, chosen by whether `DATABASE_URL` is set:

- `OrderStore` keeps orders and events in this process's memory, seeded from the JSON fixtures at
  startup. No database to provision, and a restart returns to a known-good dataset. Writes do not
  survive a restart, and two processes cannot see each other's orders.
- `PostgresOrderStore` (see `postgres_store.py`) persists the same rows, so a nurse's phone and a
  case manager's laptop read the same board and orders outlive a restart or a Render spin-down.

Both inherit the SSE fan-out below, which is transport rather than storage: a status change appends
an event and hands it straight to every connected client's queue, so latency is a function of the
network rather than a poll interval. That fan-out is in-process, which is correct while the API runs
as a single instance — see `docs/DATA_MODEL.md`.
"""

from __future__ import annotations

import asyncio
import threading
from typing import Any

from .config import get_settings
from .fixtures import seed_order_events, seed_orders

Row = dict[str, Any]

# How many events a slow client may fall behind before we start dropping. A browser that cannot
# keep up with this is not going to catch up, and an unbounded queue would grow until the process
# died.
SUBSCRIBER_QUEUE_SIZE = 100


class BaseOrderStore:
    """SSE fan-out, shared by every storage backend.

    Subscriber queues belong to the asyncio loop while writes arrive from whichever worker thread
    FastAPI ran the handler on, so this is the same tricky handoff regardless of where rows are
    kept. Subclasses supply the data methods and call `_publish` from `append_event`.
    """

    def __init__(self) -> None:
        # Guards `_subscribers` (and, in the in-memory subclass, the row dicts too).
        self._lock = threading.Lock()

        self._subscribers: set[asyncio.Queue[Row]] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Remember the loop, so a write from a worker thread can reach subscriber queues."""
        self._loop = loop

    # ── The storage contract ──────────────────────────────────────────────────
    # Implemented by OrderStore (memory) and PostgresOrderStore. Declared here so callers can be
    # annotated with the interface rather than one implementation.

    def list_orders(self) -> list[Row]:
        raise NotImplementedError

    def get_order(self, order_id: str) -> Row | None:
        raise NotImplementedError

    def put_order(self, order: Row) -> None:
        raise NotImplementedError

    def next_order_id(self) -> str:
        raise NotImplementedError

    def is_session_order(self, order_id: str) -> bool:
        raise NotImplementedError

    def events_for_order(self, order_id: str) -> list[Row]:
        raise NotImplementedError

    def all_events(self) -> list[Row]:
        raise NotImplementedError

    def events_since(self, seq: int, limit: int = 100) -> list[Row]:
        raise NotImplementedError

    def append_event(self, event: Row) -> Row:
        raise NotImplementedError

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


class OrderStore(BaseOrderStore):
    """Orders and their timeline, in this process's memory."""

    def __init__(self) -> None:
        super().__init__()

        self._orders: dict[str, Row] = {row["id"]: dict(row) for row in seed_orders()}

        # Seeded in timeline order so `seq` agrees with the order things actually happened in.
        self._events: list[Row] = []
        for index, row in enumerate(
            sorted(seed_order_events(), key=lambda event: event.get("at", "")), start=1
        ):
            self._events.append({**row, "seq": index})
        self._next_seq = len(self._events) + 1

        # Ids created since this process started, as opposed to seeded from the fixtures. The demo
        # driver only walks these forward — `canonical` does not answer the question, since 60 of
        # the 66 seeded orders are non-canonical too.
        self._session_order_ids: set[str] = set()

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
        """Continue the DME-##### series the fixtures use, and claim the id for this session.

        Claiming under the same lock that reads the high-water mark means two concurrent creates
        cannot be handed the same id.
        """
        with self._lock:
            highest = 0
            for raw_id in self._orders:
                if raw_id.startswith("DME-") and raw_id[4:].isdigit():
                    highest = max(highest, int(raw_id[4:]))
            order_id = f"DME-{max(highest, 10000) + 1}"
            self._session_order_ids.add(order_id)
        return order_id

    def is_session_order(self, order_id: str) -> bool:
        """True for an order created since startup, False for one seeded from the fixtures."""
        with self._lock:
            return order_id in self._session_order_ids

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


_store: BaseOrderStore | None = None
_store_lock = threading.Lock()


def get_store() -> BaseOrderStore:
    """One store per process: Postgres when DATABASE_URL is set, memory otherwise."""
    global _store
    if _store is None:
        with _store_lock:
            if _store is None:
                database_url = get_settings().database_url
                if database_url:
                    # Imported lazily so a local run needs neither psycopg nor a database.
                    from .postgres_store import PostgresOrderStore

                    _store = PostgresOrderStore(database_url)
                else:
                    _store = OrderStore()
    return _store


def reset_store() -> None:
    """Drop the store so the fixtures reload. Used by tests."""
    global _store
    with _store_lock:
        _store = None
