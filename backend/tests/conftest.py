from __future__ import annotations

import os

# Set before app.config is imported: Settings reads the environment in its dataclass defaults. A
# background task walking orders forward mid-test would make every order assertion flaky.
os.environ.setdefault("AUTO_ADVANCE_SECONDS", "0")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.ai.client import reset_client as reset_ai_client  # noqa: E402
from app.ai.usage import reset_usage_ledger  # noqa: E402
from app.carts import CartStore, reset_cart_store  # noqa: E402
from app.config import Settings, get_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.notes import NoteStore, reset_note_store  # noqa: E402
from app.services import notifications  # noqa: E402
from app.store import OrderStore, reset_store  # noqa: E402
from app.subscriptions import reset_subscription_store  # noqa: E402


@pytest.fixture(autouse=True)
def _isolate_state() -> None:
    """Every test gets a fresh store, subscription store, ledger, and settings cache."""
    reset_store()
    reset_cart_store()
    reset_note_store()
    reset_subscription_store()
    reset_usage_ledger()
    reset_ai_client()
    get_settings.cache_clear()
    notifications.reset_client()


@pytest.fixture
def carts() -> CartStore:
    return CartStore()


@pytest.fixture
def notes() -> NoteStore:
    return NoteStore()


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
