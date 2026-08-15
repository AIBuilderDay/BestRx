"""Runtime configuration, read once from the environment.

Every value has a default that works for local development, so `uvicorn app.main:app` runs with no
environment set up at all. In Lambda, Terraform supplies the real table and queue names.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache


def _split_csv(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    """Resolved settings for one process."""

    prefix: str = os.environ.get("BESTRX_PREFIX", "bestrx")
    aws_region: str = os.environ.get("AWS_REGION", "us-east-2")

    orders_table: str = os.environ.get("ORDERS_TABLE", "")
    order_events_table: str = os.environ.get("ORDER_EVENTS_TABLE", "")
    push_subscriptions_table: str = os.environ.get("PUSH_SUBSCRIPTIONS_TABLE", "")

    push_queue_url: str = os.environ.get("PUSH_QUEUE_URL", "")
    vapid_public_key: str = os.environ.get("VAPID_PUBLIC_KEY", "")

    cors_origins: list[str] = field(
        default_factory=lambda: _split_csv(
            os.environ.get("CORS_ORIGINS", "http://localhost:5173")
        )
    )

    @property
    def use_dynamodb(self) -> bool:
        """True when Terraform has wired real tables in.

        With no table names configured the API serves the JSON fixtures read-only, which is what
        makes `uvicorn` work locally without AWS credentials.
        """
        return bool(self.orders_table and self.order_events_table)

    @property
    def push_enabled(self) -> bool:
        """Push is best-effort. Without a queue the API still serves orders normally."""
        return bool(self.push_queue_url)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
