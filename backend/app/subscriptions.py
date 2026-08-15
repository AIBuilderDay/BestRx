"""Browser push subscriptions.

The one piece of state that cannot live in this process. The notification service runs in AWS and
reads these rows; this container writes them. Two processes, so they need shared storage — and if it
were in memory here, every container restart would silently unsubscribe every nurse with no way for
them to find out.

Hence one DynamoDB table. Orders and events stay in memory because only this process touches them.

With no table configured (local development), an in-memory implementation stands in so the API runs
with no AWS account at all.
"""

from __future__ import annotations

import threading
from typing import Any, Protocol

from .config import Settings

Row = dict[str, Any]


class SubscriptionStore(Protocol):
    def put(self, subscription: Row) -> None: ...
    def delete(self, endpoint: str) -> None: ...
    def list_all(self) -> list[Row]: ...


class MemorySubscriptionStore:
    """Local development. Subscriptions vanish on restart, which is fine when nothing is deployed."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._rows: dict[str, Row] = {}

    def put(self, subscription: Row) -> None:
        with self._lock:
            self._rows[subscription["endpoint"]] = dict(subscription)

    def delete(self, endpoint: str) -> None:
        with self._lock:
            self._rows.pop(endpoint, None)

    def list_all(self) -> list[Row]:
        with self._lock:
            return [dict(row) for row in self._rows.values()]


class DynamoSubscriptionStore:
    """The deployed path. Shared with the push Lambda, which reads and prunes the same table."""

    def __init__(self, settings: Settings) -> None:
        import boto3  # imported lazily so local runs need no AWS SDK configuration

        table = boto3.resource("dynamodb", region_name=settings.aws_region)
        self._table = table.Table(settings.push_subscriptions_table)

    def put(self, subscription: Row) -> None:
        self._table.put_item(Item=subscription)

    def delete(self, endpoint: str) -> None:
        self._table.delete_item(Key={"endpoint": endpoint})

    def list_all(self) -> list[Row]:
        rows: list[Row] = []
        kwargs: dict[str, Any] = {}
        while True:
            response = self._table.scan(**kwargs)
            rows.extend(response.get("Items", []))
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
            kwargs["ExclusiveStartKey"] = last_key
        return rows


_store: SubscriptionStore | None = None
_store_lock = threading.Lock()


def get_subscription_store(settings: Settings) -> SubscriptionStore:
    global _store
    if _store is None:
        with _store_lock:
            if _store is None:
                _store = (
                    DynamoSubscriptionStore(settings)
                    if settings.push_subscriptions_table
                    else MemorySubscriptionStore()
                )
    return _store


def reset_subscription_store() -> None:
    """Used by tests."""
    global _store
    with _store_lock:
        _store = None
