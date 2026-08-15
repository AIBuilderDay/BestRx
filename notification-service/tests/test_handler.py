"""The push Lambda: payload shape, dead-subscription cleanup, and batch failure reporting."""

from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture
def push_handler(monkeypatch: pytest.MonkeyPatch) -> Any:
    """Import the handler with its module-level AWS clients stubbed out."""
    monkeypatch.setenv("PUSH_SUBSCRIPTIONS_TABLE", "bestrx-push-subscriptions")
    monkeypatch.setenv("VAPID_SECRET_ARN", "arn:aws:secretsmanager:us-east-2:1:secret:bestrx/vapid")
    monkeypatch.setenv("APP_URL", "https://bestrx.test")

    with patch("boto3.resource"), patch("boto3.client"):
        module = importlib.import_module("handler")
        module = importlib.reload(module)

    module._vapid_private_key = "test-private-key"
    return module


def _message(**overrides: Any) -> dict[str, Any]:
    base = {
        "type": "order.status_changed",
        "orderId": "DME-10231",
        "status": "in_transit",
        "hospiceId": "HSP-001",
        "urgency": "routine",
        "detail": "Order DME-10231 is on the truck and en route.",
        "seq": 42,
    }
    return {**base, **overrides}


def test_notification_uses_only_event_data(push_handler: Any) -> None:
    notification = push_handler.build_notification(_message())

    assert notification["title"] == "Equipment on the way"
    assert notification["body"] == "Order DME-10231 is on the truck and en route."
    assert notification["data"]["orderId"] == "DME-10231"
    assert notification["data"]["url"].endswith("/orders/DME-10231")


def test_stat_urgency_is_marked_in_the_title(push_handler: Any) -> None:
    notification = push_handler.build_notification(_message(urgency="stat"))
    assert notification["title"].startswith("STAT — ")


def test_tag_collapses_repeat_updates_for_one_order(push_handler: Any) -> None:
    """A phone should show one line per order, not one per status change."""
    first = push_handler.build_notification(_message(status="dispatched"))
    second = push_handler.build_notification(_message(status="delivered"))
    assert first["tag"] == second["tag"] == "order-DME-10231"


def test_missing_detail_falls_back_to_a_sane_body(push_handler: Any) -> None:
    notification = push_handler.build_notification(_message(detail=""))
    assert "DME-10231" in notification["body"]


def test_gone_subscription_is_deleted(push_handler: Any) -> None:
    response = MagicMock()
    response.status_code = 410
    exception = push_handler.WebPushException("gone", response=response)

    with patch.object(push_handler, "webpush", side_effect=exception):
        push_handler._send_one(
            {"endpoint": "https://fcm.test/dead", "keys": {"p256dh": "k", "auth": "a"}},
            {"title": "t", "body": "b"},
        )

    push_handler._table.delete_item.assert_called_once_with(
        Key={"endpoint": "https://fcm.test/dead"}
    )


def test_transient_failure_is_raised_for_retry(push_handler: Any) -> None:
    response = MagicMock()
    response.status_code = 500
    exception = push_handler.WebPushException("server error", response=response)

    with patch.object(push_handler, "webpush", side_effect=exception):
        with pytest.raises(push_handler.WebPushException):
            push_handler._send_one(
                {"endpoint": "https://fcm.test/flaky", "keys": {"p256dh": "k", "auth": "a"}},
                {"title": "t", "body": "b"},
            )

    push_handler._table.delete_item.assert_not_called()


def test_unparseable_message_goes_to_dlq_not_retry(push_handler: Any) -> None:
    """Retrying malformed JSON only burns the queue — let it fall through to the DLQ."""
    result = push_handler.handler({"Records": [{"messageId": "m1", "body": "not json"}]})
    assert result["batchItemFailures"] == []


def test_failed_message_is_reported_for_partial_retry(push_handler: Any) -> None:
    with patch.object(push_handler, "process_message", side_effect=RuntimeError("boom")):
        result = push_handler.handler(
            {
                "Records": [
                    {"messageId": "m1", "body": json.dumps(_message())},
                    {"messageId": "m2", "body": json.dumps(_message())},
                ]
            }
        )

    assert result["batchItemFailures"] == [
        {"itemIdentifier": "m1"},
        {"itemIdentifier": "m2"},
    ]


def test_one_bad_endpoint_does_not_block_the_others(push_handler: Any) -> None:
    subscriptions = [
        {"endpoint": "https://fcm.test/good", "keys": {"p256dh": "k", "auth": "a"}},
        {"endpoint": "https://fcm.test/bad", "keys": {"p256dh": "k", "auth": "a"}},
    ]

    def send(subscription: dict[str, Any], _notification: dict[str, Any]) -> None:
        if subscription["endpoint"].endswith("bad"):
            raise RuntimeError("unreachable")

    with (
        patch.object(push_handler, "_subscriptions_for", return_value=subscriptions),
        patch.object(push_handler, "_send_one", side_effect=send),
    ):
        delivered = push_handler.process_message(json.dumps(_message()))

    assert delivered == 1


def test_total_failure_raises_so_sqs_retries(push_handler: Any) -> None:
    subscriptions = [{"endpoint": "https://fcm.test/a", "keys": {"p256dh": "k", "auth": "a"}}]

    with (
        patch.object(push_handler, "_subscriptions_for", return_value=subscriptions),
        patch.object(push_handler, "_send_one", side_effect=RuntimeError("push service down")),
    ):
        with pytest.raises(RuntimeError):
            push_handler.process_message(json.dumps(_message()))


def test_no_subscriptions_is_not_an_error(push_handler: Any) -> None:
    with patch.object(push_handler, "_subscriptions_for", return_value=[]):
        assert push_handler.process_message(json.dumps(_message())) == 0
