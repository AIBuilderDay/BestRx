from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.ai.client import reset_client as reset_ai_client
from app.ai.usage import reset_usage_ledger
from app.carts import CartStore, reset_cart_store
from app.config import Settings, get_settings
from app.main import app
from app.services import notifications
from app.store import OrderStore, reset_store
from app.subscriptions import reset_subscription_store


@pytest.fixture(autouse=True)
def _isolate_state() -> None:
    """Every test gets a fresh store, subscription store, ledger, and settings cache."""
    reset_store()
    reset_cart_store()
    reset_subscription_store()
    reset_usage_ledger()
    reset_ai_client()
    get_settings.cache_clear()
    notifications.reset_client()


@pytest.fixture
def carts() -> CartStore:
    return CartStore()


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
