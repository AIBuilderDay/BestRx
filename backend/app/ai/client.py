"""The one place this process talks to Anthropic.

The key is read from Settings and never leaves the container. When it is unset, `get_client`
raises `AiUnavailable`, the routers turn that into a 503, and every frontend caller falls back to
plain deterministic search — AI is an enhancement here, never a dependency.
"""

from __future__ import annotations

from functools import lru_cache

from anthropic import AsyncAnthropic

from ..config import Settings


class AiUnavailable(Exception):
    """No API key configured. The caller answers 503 and the UI falls back to plain search."""

    def __init__(self) -> None:
        super().__init__(
            "AI is not configured. Set ANTHROPIC_API_KEY on the API to enable AI search."
        )


@lru_cache(maxsize=1)
def _client(api_key: str, timeout: float) -> AsyncAnthropic:
    # Cached on the key so one HTTP connection pool is shared across requests. Async because the
    # agent loop makes several sequential calls and must not block the event loop that serves SSE.
    return AsyncAnthropic(api_key=api_key, timeout=timeout, max_retries=1)


def get_client(settings: Settings) -> AsyncAnthropic:
    if not settings.ai_enabled:
        raise AiUnavailable
    return _client(settings.anthropic_api_key, settings.ai_timeout_seconds)


def reset_client() -> None:
    """Drop the cached client so a settings change takes effect. Used by the test fixtures."""
    _client.cache_clear()
