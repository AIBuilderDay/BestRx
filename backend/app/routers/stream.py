"""Server-sent events.

The live half of the notification story: this updates a tab that is already open. Web Push covers
the tab that is not, and that runs in AWS — see ../../notification-service/.

Each connection subscribes to the store and waits. A status change hands the event straight to this
queue, so latency is the network rather than a poll interval, and the connection lives as long as
the client keeps it open.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import StreamingResponse

from ..store import BaseOrderStore, get_store

router = APIRouter(tags=["stream"])

# Without traffic, proxies and load balancers drop an idle connection. A comment frame is valid SSE
# and costs nothing.
HEARTBEAT_SECONDS = 15


def _frame(event: str, data: Any, event_id: int | None = None) -> str:
    lines = []
    if event_id is not None:
        # The browser echoes this back as Last-Event-ID when it reconnects.
        lines.append(f"id: {event_id}")
    lines.append(f"event: {event}")
    lines.append(f"data: {json.dumps(data)}")
    return "\n".join(lines) + "\n\n"


def _resolve_cursor(last_event_id: str | None, since: int | None) -> int:
    """Where to resume from.

    Last-Event-ID wins: the browser sets it automatically on reconnect, and honouring it is what
    makes the reconnect seamless. `since` is the manual equivalent for a first connection.
    """
    if last_event_id:
        try:
            return max(0, int(last_event_id))
        except ValueError:
            pass
    return max(0, since or 0)


async def _event_stream(
    request: Request,
    store: BaseOrderStore,
    hospice_id: str | None,
    cursor: int,
) -> AsyncIterator[str]:
    queue = store.subscribe()
    try:
        yield _frame("connected", {"cursor": cursor, "hospiceId": hospice_id})

        # Highest seq actually sent. Tracked separately from the requested cursor: a client may ask
        # to resume from a seq beyond the current tip (a stale cursor, or a restart that reset the
        # in-memory store), and comparing live events against that number would silently drop every
        # one of them.
        sent_through = 0

        # Anything missed while disconnected, before live events start flowing.
        for event in store.events_since(cursor):
            if _matches(event, hospice_id, store):
                seq = int(event.get("seq", 0))
                yield _frame("order-status", event, event_id=seq)
                sent_through = max(sent_through, seq)

        while True:
            if await request.is_disconnected():
                break

            try:
                event = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                yield ": heartbeat\n\n"
                continue

            seq = int(event.get("seq", 0))
            if seq <= sent_through:
                continue  # already sent during backfill
            if not _matches(event, hospice_id, store):
                continue

            sent_through = seq
            yield _frame("order-status", event, event_id=seq)
    finally:
        # Must run whether the client disconnected cleanly or the task was cancelled, or the
        # subscriber set leaks a queue per dropped connection.
        store.unsubscribe(queue)


def _matches(event: dict[str, Any], hospice_id: str | None, store: BaseOrderStore) -> bool:
    """Filter by hospice, resolving through the event's order.

    Events carry no hospiceId of their own, so an unknown order is treated as non-matching rather
    than leaking another network's activity.
    """
    if not hospice_id:
        return True
    order = store.get_order(str(event.get("orderId", "")))
    return bool(order) and order.get("hospiceId") == hospice_id


@router.get("/stream")
async def stream_order_events(
    request: Request,
    hospiceId: str | None = Query(default=None),
    since: int | None = Query(default=None, ge=0),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    store: BaseOrderStore = Depends(get_store),
) -> StreamingResponse:
    """Open an SSE stream of order status changes."""
    cursor = _resolve_cursor(last_event_id, since)

    return StreamingResponse(
        _event_stream(request, store, hospiceId, cursor),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # nginx buffers proxied responses by default, which would hold every frame back.
            "X-Accel-Buffering": "no",
        },
    )
