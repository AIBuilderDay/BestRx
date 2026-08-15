"""SSE.

The property that matters: a status change reaches a connected client without polling, and a
reconnecting client resumes without replaying or skipping.
"""

from __future__ import annotations

import asyncio

import pytest

from app.config import Settings
from app.routers.stream import _event_stream
from app.services import orders as service
from app.store import OrderStore


def _first_ordered(store: OrderStore) -> dict:
    return [o for o in store.list_orders() if o["status"] == "ordered"][0]


class _NeverDisconnected:
    """Stands in for a Request whose client stays connected."""

    async def is_disconnected(self) -> bool:
        return False


def test_subscribe_and_unsubscribe_are_tracked(store: OrderStore) -> None:
    assert store.subscriber_count == 0

    queue = store.subscribe()
    assert store.subscriber_count == 1

    store.unsubscribe(queue)
    assert store.subscriber_count == 0


@pytest.mark.asyncio
async def test_status_change_reaches_a_subscriber(store: OrderStore, settings: Settings) -> None:
    store.bind_loop(asyncio.get_running_loop())
    queue = store.subscribe()
    order = _first_ordered(store)

    service.change_status(store, settings, order["id"], "dispatched")

    event = await asyncio.wait_for(queue.get(), timeout=2)
    assert event["orderId"] == order["id"]
    assert event["event"] == "dispatched"
    assert event["seq"] > 0


@pytest.mark.asyncio
async def test_every_subscriber_gets_the_event(store: OrderStore, settings: Settings) -> None:
    store.bind_loop(asyncio.get_running_loop())
    first, second = store.subscribe(), store.subscribe()
    order = _first_ordered(store)

    service.change_status(store, settings, order["id"], "dispatched")

    for queue in (first, second):
        event = await asyncio.wait_for(queue.get(), timeout=2)
        assert event["orderId"] == order["id"]


@pytest.mark.asyncio
async def test_an_unsubscribed_client_stops_receiving(
    store: OrderStore, settings: Settings
) -> None:
    store.bind_loop(asyncio.get_running_loop())
    queue = store.subscribe()
    store.unsubscribe(queue)

    service.change_status(store, settings, _first_ordered(store)["id"], "dispatched")

    await asyncio.sleep(0.05)
    assert queue.empty()


def test_events_since_backfills_only_newer(store: OrderStore, settings: Settings) -> None:
    """What a reconnecting client receives before live events resume."""
    order = _first_ordered(store)
    _, event = service.change_status(store, settings, order["id"], "dispatched")

    assert store.events_since(event["seq"]) == []

    backfill = store.events_since(event["seq"] - 1)
    assert [e["seq"] for e in backfill] == [event["seq"]]


def test_seq_increases_across_orders(store: OrderStore, settings: Settings) -> None:
    """SSE orders by seq, so it must be monotonic across every order, not per order."""
    ordered = [o for o in store.list_orders() if o["status"] == "ordered"]

    _, first = service.change_status(store, settings, ordered[0]["id"], "dispatched")
    _, second = service.change_status(store, settings, ordered[1]["id"], "dispatched")

    assert second["seq"] > first["seq"]


def test_slow_client_is_dropped_rather_than_blocking(
    store: OrderStore, settings: Settings
) -> None:
    """A full queue must never stall the write path — the client resyncs on reconnect."""
    from app.store import SUBSCRIBER_QUEUE_SIZE

    queue = store.subscribe()
    for _ in range(SUBSCRIBER_QUEUE_SIZE):
        queue.put_nowait({"seq": 0})

    order = _first_ordered(store)
    updated, _ = service.change_status(store, settings, order["id"], "dispatched")

    assert updated["status"] == "dispatched"


@pytest.mark.asyncio
async def test_stream_opens_with_a_connected_frame_then_delivers(
    store: OrderStore, settings: Settings
) -> None:
    """The generator behind GET /stream.

    Driven directly rather than through TestClient: the endpoint is an infinite stream by design, so
    an HTTP client would block until the test timed out.
    """
    store.bind_loop(asyncio.get_running_loop())

    # Start at the current tip so the seeded fixture events are not replayed as backfill; this test
    # is about live delivery. Backfill has its own test.
    tip = max(e["seq"] for e in store.events_since(0, limit=10_000))
    stream = _event_stream(_NeverDisconnected(), store, None, tip)

    first = await asyncio.wait_for(anext(stream), timeout=2)
    assert first.startswith("event: connected")

    order = _first_ordered(store)
    service.change_status(store, settings, order["id"], "dispatched")

    frame = await asyncio.wait_for(anext(stream), timeout=2)
    assert "event: order-status" in frame
    assert order["id"] in frame
    # The id line is what the browser echoes back as Last-Event-ID.
    assert frame.startswith("id: ")

    await stream.aclose()
    assert store.subscriber_count == 0, "closing the stream must release the subscriber"


@pytest.mark.asyncio
async def test_a_cursor_beyond_the_tip_still_receives_live_events(
    store: OrderStore, settings: Settings
) -> None:
    """A stale or impossible cursor must not silence the stream.

    Regression: live events were compared against the *requested* cursor, so a client resuming from
    a seq past the current tip — a stale cursor, or a restart that reset the in-memory store —
    silently received nothing at all.
    """
    store.bind_loop(asyncio.get_running_loop())

    stream = _event_stream(_NeverDisconnected(), store, None, 10**9)
    await asyncio.wait_for(anext(stream), timeout=2)  # connected frame

    order = _first_ordered(store)
    service.change_status(store, settings, order["id"], "dispatched")

    frame = await asyncio.wait_for(anext(stream), timeout=2)
    assert "event: order-status" in frame
    assert order["id"] in frame

    await stream.aclose()


@pytest.mark.asyncio
async def test_stream_filters_by_hospice(store: OrderStore, settings: Settings) -> None:
    """A nurse must not be woken by another network's orders."""
    store.bind_loop(asyncio.get_running_loop())

    order = _first_ordered(store)
    other_hospice = "HSP-999"
    assert order["hospiceId"] != other_hospice

    tip = max(e["seq"] for e in store.events_since(0, limit=10_000))
    stream = _event_stream(_NeverDisconnected(), store, other_hospice, tip)
    await asyncio.wait_for(anext(stream), timeout=2)  # connected frame

    service.change_status(store, settings, order["id"], "dispatched")

    # Only the heartbeat should arrive; the event belongs to a different hospice.
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(anext(stream), timeout=0.3)

    await stream.aclose()
