"""The demo driver: orders placed in this session walk themselves forward.

Nobody is standing behind a real vendor's dispatch system during a demo, so an order created at the
storefront would otherwise sit at `ordered` forever and neither notification channel would ever have
anything to say. This ticks every few seconds and moves each in-flight order one step along its
track.

It goes through `orders.change_status` rather than touching the store, so an automatic move is
indistinguishable from a manual `PATCH /orders/{id}/status`: same validation, same event appended,
same SSE fan-out, same SQS enqueue. There is no second, quieter way for an order to change status.

Only orders created since this process started move. The seeded fixtures are the stable baseline the
board is read against — walking those forward on a timer would drain the whole board to `delivered`
within seconds of startup and rewrite the dataset the demo is explaining. Note that `canonical` does
not answer this question: only six of the 66 seeded orders are canonical, so the store tracks which
ids it minted instead.
"""

from __future__ import annotations

import asyncio
import logging

from ..config import Settings
from ..lifecycle import allowed_next
from ..store import OrderStore
from . import orders as service

logger = logging.getLogger(__name__)

# The actor recorded on an automatic transition. A timeline reader can tell it from a nurse's move.
AUTO_ACTOR_ID = "system:auto-advance"


def _next_status(current: str) -> str | None:
    """The single forward step from `current`, or None at a terminal status.

    Every non-terminal status has exactly one successor today, so "the next one" is unambiguous.
    Sorting keeps it deterministic if a branch is ever added.
    """
    options = allowed_next(current)
    return sorted(options)[0] if options else None


def advance_once(store: OrderStore, settings: Settings) -> list[str]:
    """Move every eligible order one step. Returns the ids that changed."""
    moved: list[str] = []

    for order in store.list_orders():
        # Seeded orders are the fixed reference dataset; only orders placed since startup move.
        if not store.is_session_order(str(order["id"])):
            continue

        target = _next_status(str(order.get("status", "")))
        if target is None:
            continue

        try:
            service.change_status(
                store,
                settings,
                str(order["id"]),
                target,
                actor_id=AUTO_ACTOR_ID,
            )
        except (service.OrderNotFound, service.InvalidTransition):
            # Something else moved or removed the order between the read and the write. The other
            # writer wins; this tick simply skips it.
            continue

        moved.append(str(order["id"]))

    return moved


async def run_loop(store: OrderStore, settings: Settings) -> None:
    """Tick until cancelled. One bad tick must not kill the loop, so failures are logged only."""
    logger.info("auto-advance running every %ss", settings.auto_advance_seconds)
    while True:
        await asyncio.sleep(settings.auto_advance_seconds)
        try:
            # change_status does blocking work (an SQS send when push is wired), so it runs off the
            # event loop — this process is holding SSE connections open on that loop.
            moved = await asyncio.to_thread(advance_once, store, settings)
        except Exception:  # noqa: BLE001 - a demo driver must never take the API down with it
            logger.exception("auto-advance tick failed")
            continue
        if moved:
            logger.info("auto-advanced %s", ", ".join(moved))
