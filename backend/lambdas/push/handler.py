"""Push notification sender.

SQS-triggered. Takes an order status change and delivers it to every browser subscription for that
hospice, signed with VAPID.

This is the notification service: separate from the API, fronted by a queue, scaled by SQS. A burst
of status changes queues up here instead of backpressuring the order API, and a failing push service
retries on its own without touching anything else.

Partial batch failure is reported through `batchItemFailures`, so one bad message is retried on its
own rather than replaying the whole batch and double-notifying everyone in it.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import boto3
from boto3.dynamodb.conditions import Attr
from pywebpush import WebPushException, webpush

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SUBSCRIPTIONS_TABLE = os.environ["PUSH_SUBSCRIPTIONS_TABLE"]
VAPID_SECRET_ARN = os.environ["VAPID_SECRET_ARN"]
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:ylim.8299+bestrx-vapid@gmail.com")
APP_URL = os.environ.get("APP_URL", "http://localhost:5173")

# A dead subscription: the browser was uninstalled, or the user revoked permission.
GONE_STATUS_CODES = {404, 410}

_dynamodb = boto3.resource("dynamodb")
_table = _dynamodb.Table(SUBSCRIPTIONS_TABLE)
_secrets = boto3.client("secretsmanager")

_vapid_private_key: str | None = None


def _load_vapid_private_key() -> str:
    """Read the private key once per container, never from an environment variable."""
    global _vapid_private_key
    if _vapid_private_key is None:
        response = _secrets.get_secret_value(SecretId=VAPID_SECRET_ARN)
        secret = json.loads(response["SecretString"])
        _vapid_private_key = secret["privateKey"]
    return _vapid_private_key


def _title_for(status: str, urgency: str | None) -> str:
    titles = {
        "ordered": "Order placed",
        "dispatched": "Order dispatched",
        "in_transit": "Equipment on the way",
        "delivered": "Equipment delivered",
        "pickup_triggered": "Pickup requested",
        "picked_up": "Equipment picked up",
    }
    title = titles.get(status, "Order updated")
    return f"STAT — {title}" if urgency == "stat" else title


def build_notification(message: dict[str, Any]) -> dict[str, Any]:
    """The payload the Service Worker renders.

    Every field comes from the order event. Nothing clinical is invented here.
    """
    order_id = message.get("orderId", "")
    return {
        "title": _title_for(message.get("status", ""), message.get("urgency")),
        "body": message.get("detail") or f"Order {order_id} updated.",
        "tag": f"order-{order_id}",
        "data": {
            "orderId": order_id,
            "status": message.get("status"),
            "seq": message.get("seq"),
            "url": f"{APP_URL}/orders/{order_id}",
        },
    }


def _subscriptions_for(hospice_id: str | None) -> list[dict[str, Any]]:
    """Every subscription for a hospice, plus any that never declared one."""
    scan_kwargs: dict[str, Any] = {}
    if hospice_id:
        scan_kwargs["FilterExpression"] = Attr("hospiceId").eq(hospice_id) | Attr(
            "hospiceId"
        ).not_exists()

    items: list[dict[str, Any]] = []
    while True:
        response = _table.scan(**scan_kwargs)
        items.extend(response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        scan_kwargs["ExclusiveStartKey"] = last_key
    return items


def _send_one(subscription: dict[str, Any], notification: dict[str, Any]) -> None:
    """Deliver to one browser. Raises on a failure worth retrying."""
    endpoint = subscription["endpoint"]
    try:
        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": dict(subscription.get("keys", {})),
            },
            data=json.dumps(notification),
            vapid_private_key=_load_vapid_private_key(),
            vapid_claims={"sub": VAPID_SUBJECT},
            timeout=10,
        )
    except WebPushException as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status in GONE_STATUS_CODES:
            # The subscription is dead. Delete it, or every future send wastes a call.
            logger.info("removing dead subscription %s (status %s)", endpoint, status)
            _table.delete_item(Key={"endpoint": endpoint})
            return
        raise


def process_message(body: str) -> int:
    """Handle one SQS message. Returns how many notifications were delivered."""
    message = json.loads(body)
    notification = build_notification(message)
    subscriptions = _subscriptions_for(message.get("hospiceId"))

    if not subscriptions:
        logger.info("no subscriptions for hospice %s", message.get("hospiceId"))
        return 0

    delivered = 0
    failures: list[str] = []
    for subscription in subscriptions:
        try:
            _send_one(subscription, notification)
            delivered += 1
        except Exception as exc:  # noqa: BLE001 - one bad endpoint must not stop the others
            logger.warning("push failed for %s: %s", subscription.get("endpoint"), exc)
            failures.append(str(subscription.get("endpoint")))

    if failures and delivered == 0:
        # Everything failed, so the cause is likely shared (bad key, push service down). Retry.
        raise RuntimeError(f"all {len(failures)} push sends failed")

    return delivered


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    """SQS entrypoint. Reports per-message failures for partial batch retry."""
    batch_item_failures: list[dict[str, str]] = []

    for record in event.get("Records", []):
        message_id = record.get("messageId", "")
        try:
            delivered = process_message(record["body"])
            logger.info("message %s delivered to %d subscriptions", message_id, delivered)
        except json.JSONDecodeError:
            # Malformed and unretryable — retrying only burns the queue. Drop it to the DLQ.
            logger.exception("dropping unparseable message %s", message_id)
        except Exception:  # noqa: BLE001 - report for retry rather than failing the whole batch
            logger.exception("message %s failed; will retry", message_id)
            batch_item_failures.append({"itemIdentifier": message_id})

    return {"batchItemFailures": batch_item_failures}
