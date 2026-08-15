"""Runtime configuration, read once from the environment.

Every value has a default that works for local development, so `uvicorn app.main:app` runs with no
environment set up at all. On EC2, docker-compose supplies the queue URL and the subscriptions
table.
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

    # The only shared state: the notification service reads these rows from AWS. Orders and events
    # live in this process's memory (see store.py).
    push_subscriptions_table: str = os.environ.get("PUSH_SUBSCRIPTIONS_TABLE", "")

    push_queue_url: str = os.environ.get("PUSH_QUEUE_URL", "")
    vapid_public_key: str = os.environ.get("VAPID_PUBLIC_KEY", "")

    cors_origins: list[str] = field(
        default_factory=lambda: _split_csv(
            os.environ.get("CORS_ORIGINS", "http://localhost:5173")
        )
    )

    # Demo driver: how often a background task walks new orders one step forward. 0 disables it,
    # which is what the tests use — a task mutating the store mid-assertion makes them flaky.
    auto_advance_seconds: float = float(os.environ.get("AUTO_ADVANCE_SECONDS", "5"))

    # The AI endpoints. The key lives here and never reaches the browser — that is the whole
    # reason the model calls moved out of the frontend.
    anthropic_api_key: str = os.environ.get("ANTHROPIC_API_KEY", "")
    # Haiku 4.5: fast enough for a nurse waiting on a search, cheap enough to call per query.
    ai_model: str = os.environ.get("AI_MODEL", "claude-haiku-4-5")
    # Hard ceiling on how long a nurse waits before the caller falls back to plain search.
    ai_timeout_seconds: float = float(os.environ.get("AI_TIMEOUT_SECONDS", "15"))
    # The agent may call MCP tools this many times before we stop and answer with what we have.
    ai_max_tool_turns: int = int(os.environ.get("AI_MAX_TOOL_TURNS", "6"))

    @property
    def ai_enabled(self) -> bool:
        """Without a key the AI endpoints answer 503 and every caller falls back to plain search."""
        return bool(self.anthropic_api_key)

    @property
    def auto_advance_enabled(self) -> bool:
        """False when AUTO_ADVANCE_SECONDS is 0: orders then move only when asked to."""
        return self.auto_advance_seconds > 0

    @property
    def push_enabled(self) -> bool:
        """Push is best-effort. Without a queue the API still serves orders normally."""
        return bool(self.push_queue_url)

    @property
    def subscriptions_persisted(self) -> bool:
        """False locally, where subscriptions are kept in memory and lost on restart."""
        return bool(self.push_subscriptions_table)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
