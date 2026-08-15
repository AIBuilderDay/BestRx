"""Order creation and status changes, including the enqueue that feeds the notification service."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from app.config import Settings
from app.store import OrderStore
from app.services import orders as service


def _first_order_with_status(store: OrderStore, status: str) -> dict[str, Any]:
    matches = [o for o in store.list_orders() if o.get("status") == status]
    assert matches, f"fixtures contain no {status} order"
    return matches[0]


def test_change_status_writes_order_and_event(
    store: OrderStore, settings: Settings
) -> None:
    order = _first_order_with_status(store, "ordered")
    before = len(store.events_for_order(order["id"]))

    updated, event = service.change_status(store, settings, order["id"], "dispatched")

    assert updated["status"] == "dispatched"
    assert store.get_order(order["id"])["status"] == "dispatched"
    assert event["event"] == "dispatched"
    assert event["orderId"] == order["id"]
    assert len(store.events_for_order(order["id"])) == before + 1


def test_change_status_assigns_increasing_seq(
    store: OrderStore, settings: Settings
) -> None:
    """SSE pages forward on seq, so a later event must always sort after an earlier one."""
    first = _first_order_with_status(store, "ordered")
    second = [o for o in store.list_orders() if o["status"] == "ordered" and o["id"] != first["id"]][0]

    _, event_one = service.change_status(store, settings, first["id"], "dispatched")
    _, event_two = service.change_status(store, settings, second["id"], "dispatched")

    assert event_two["seq"] > event_one["seq"]


def test_delivered_stamps_timestamp_and_clears_risk(
    store: OrderStore, settings: Settings
) -> None:
    order = _first_order_with_status(store, "in_transit")

    updated, _ = service.change_status(store, settings, order["id"], "delivered")

    assert updated["deliveredAt"]
    assert updated["eta"] == updated["deliveredAt"]
    assert updated["riskState"] is None


def test_invalid_transition_raises_and_writes_nothing(
    store: OrderStore, settings: Settings
) -> None:
    order = _first_order_with_status(store, "ordered")
    before = len(store.events_for_order(order["id"]))

    with pytest.raises(service.InvalidTransition) as exc_info:
        service.change_status(store, settings, order["id"], "delivered")

    assert exc_info.value.allowed == ["dispatched"]
    assert store.get_order(order["id"])["status"] == "ordered"
    assert len(store.events_for_order(order["id"])) == before


def test_missing_order_raises() -> None:
    store = OrderStore()
    with pytest.raises(service.OrderNotFound):
        service.change_status(store, Settings(), "DME-00000", "dispatched")


def test_status_change_enqueues_exactly_one_message(store: OrderStore) -> None:
    configured = Settings(
        push_queue_url="https://sqs.test/queue"
    )
    order = _first_order_with_status(store, "ordered")

    with patch("app.services.notifications._sqs") as sqs:
        service.change_status(store, configured, order["id"], "dispatched")

    assert sqs.return_value.send_message.call_count == 1


def test_invalid_transition_enqueues_nothing(store: OrderStore) -> None:
    configured = Settings(
        push_queue_url="https://sqs.test/queue"
    )
    order = _first_order_with_status(store, "ordered")

    with patch("app.services.notifications._sqs") as sqs, pytest.raises(service.InvalidTransition):
        service.change_status(store, configured, order["id"], "delivered")

    sqs.return_value.send_message.assert_not_called()


def test_enqueue_failure_does_not_fail_the_update(store: OrderStore) -> None:
    """Push is best-effort. The order update is already committed by the time we enqueue."""
    configured = Settings(
        push_queue_url="https://sqs.test/queue"
    )
    order = _first_order_with_status(store, "ordered")

    with patch("app.services.notifications._sqs") as sqs:
        sqs.return_value.send_message.side_effect = RuntimeError("SQS is down")
        updated, _ = service.change_status(store, configured, order["id"], "dispatched")

    assert updated["status"] == "dispatched"


def test_create_order_opens_a_timeline(store: OrderStore, settings: Settings) -> None:
    patient = store.list_orders()[0]["patientId"]

    order = service.create_order(
        store,
        settings,
        {
            "patientId": patient,
            "hospiceId": "HSP-001",
            "vendorId": "VND-001",
            "orderedById": "USR-001",
            "orderType": "routine",
            "urgency": "routine",
            "equipment": [{"hcpcs": "E0250", "name": "Hospital Bed", "qty": 1}],
            "notes": "",
        },
    )

    assert order["status"] == "ordered"
    assert order["canonical"] is False
    assert store.get_order(order["id"]) is not None

    events = store.events_for_order(order["id"])
    assert len(events) == 1
    assert events[0]["event"] == "ordered"


def test_create_order_rejects_unknown_patient(
    store: OrderStore, settings: Settings
) -> None:
    with pytest.raises(service.UnknownPatient):
        service.create_order(
            store,
            settings,
            {
                "patientId": "PT-00000",
                "hospiceId": "HSP-001",
                "equipment": [{"hcpcs": "E0250", "name": "Hospital Bed", "qty": 1}],
            },
        )


def test_new_order_ids_do_not_collide(store: OrderStore, settings: Settings) -> None:
    patient = store.list_orders()[0]["patientId"]
    payload = {
        "patientId": patient,
        "hospiceId": "HSP-001",
        "equipment": [{"hcpcs": "E0250", "name": "Hospital Bed", "qty": 1}],
    }

    first = service.create_order(store, settings, dict(payload))
    second = service.create_order(store, settings, dict(payload))

    assert first["id"] != second["id"]
