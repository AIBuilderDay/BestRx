"""The demo driver that walks this session's orders forward on a timer."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

from app.config import Settings
from app.services import autoadvance
from app.services import orders as service
from app.store import OrderStore


def _new_order(store: OrderStore, settings: Settings) -> dict[str, Any]:
    """An order created through the service, as a real checkout would."""
    patient = store.list_orders()[0]["patientId"]
    return service.create_order(
        store,
        settings,
        {
            "patientId": patient,
            "hospiceId": "HSP-001",
            "vendorId": "VND-001",
            "equipment": [{"hcpcs": "E0250", "name": "Hospital Bed", "qty": 1}],
        },
    )


def test_advance_walks_a_new_order_down_the_delivery_track(
    store: OrderStore, settings: Settings
) -> None:
    order = _new_order(store, settings)

    for expected in ("dispatched", "in_transit", "delivered"):
        autoadvance.advance_once(store, settings)
        assert store.get_order(order["id"])["status"] == expected


def test_advance_stops_at_a_terminal_status(
    store: OrderStore, settings: Settings
) -> None:
    order = _new_order(store, settings)
    for _ in range(3):
        autoadvance.advance_once(store, settings)

    moved = autoadvance.advance_once(store, settings)

    assert order["id"] not in moved
    assert store.get_order(order["id"])["status"] == "delivered"


def test_seeded_orders_never_move(store: OrderStore, settings: Settings) -> None:
    """The fixtures are the reference dataset the board is read against.

    Guards the discriminator specifically: 60 of the 66 seeded orders are non-canonical, so keying
    on `canonical` here would drain most of the board on the first tick.
    """
    before = {o["id"]: o["status"] for o in store.list_orders()}
    assert len(before) > 6, "fixtures should seed more than the canonical orders"

    moved = autoadvance.advance_once(store, settings)

    assert moved == []
    assert {o["id"]: o["status"] for o in store.list_orders()} == before


def test_advance_appends_an_event_attributed_to_the_system(
    store: OrderStore, settings: Settings
) -> None:
    order = _new_order(store, settings)

    autoadvance.advance_once(store, settings)

    events = store.events_for_order(order["id"])
    assert events[-1]["event"] == "dispatched"
    assert events[-1]["actorId"] == autoadvance.AUTO_ACTOR_ID


def test_advance_enqueues_a_push_per_moved_order(store: OrderStore) -> None:
    """The whole point: an automatic move notifies exactly as a manual PATCH does."""
    configured = Settings(push_queue_url="https://sqs.test/queue")

    with patch("app.services.notifications._sqs") as sqs:
        _new_order(store, configured)  # one enqueue for the creation itself
        sqs.return_value.send_message.reset_mock()

        moved = autoadvance.advance_once(store, configured)

    assert len(moved) == 1
    assert sqs.return_value.send_message.call_count == 1


def test_advance_survives_a_failing_enqueue(store: OrderStore) -> None:
    configured = Settings(push_queue_url="https://sqs.test/queue")

    with patch("app.services.notifications._sqs") as sqs:
        order = _new_order(store, configured)
        sqs.return_value.send_message.side_effect = RuntimeError("SQS is down")
        autoadvance.advance_once(store, configured)

    assert store.get_order(order["id"])["status"] == "dispatched"


def test_auto_advance_is_disabled_by_a_zero_interval() -> None:
    assert Settings(auto_advance_seconds=0).auto_advance_enabled is False
    assert Settings(auto_advance_seconds=5).auto_advance_enabled is True
