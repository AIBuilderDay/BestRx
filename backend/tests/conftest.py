from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.services import notifications
from app.store import OrderStore, reset_store
from app.subscriptions import reset_subscription_store


@pytest.fixture(autouse=True)
def _isolate_state() -> None:
    """Every test gets a fresh store, subscription store, and settings cache."""
    reset_store()
    reset_subscription_store()
    get_settings.cache_clear()
    notifications.reset_client()


@pytest.fixture
def store() -> OrderStore:
    return OrderStore()


@pytest.fixture
def settings() -> Settings:
    """Settings with no AWS wiring — the local development path."""
    return Settings(push_subscriptions_table="", push_queue_url="")


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
