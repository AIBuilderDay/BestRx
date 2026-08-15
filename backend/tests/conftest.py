from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.repository import MemoryRepository, reset_repository
from app.services import notifications


@pytest.fixture(autouse=True)
def _isolate_state() -> None:
    """Every test gets a fresh repository and settings cache."""
    reset_repository()
    get_settings.cache_clear()
    notifications.reset_client()


@pytest.fixture
def repo() -> MemoryRepository:
    return MemoryRepository()


@pytest.fixture
def settings() -> Settings:
    """Settings with no AWS wiring — the local development path."""
    return Settings(
        orders_table="",
        order_events_table="",
        push_subscriptions_table="",
        push_queue_url="",
    )


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
