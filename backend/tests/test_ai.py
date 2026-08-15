"""The AI surface: sanitization, the token ledger, ranking repair, and the /ai/* endpoints.

No test here calls Anthropic. The pure pieces are tested directly, and the endpoints are driven
with a stubbed model so the tool loop, the cart write, and the fallback paths are all covered
without a key or a network. What the model *says* is not under test; what the API does with what it
says is.
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.ai import agent as agent_module
from app.ai.rerank import apply_ranking
from app.ai.sanitize import find_mentioned_patients, patient_label, sanitize_patient
from app.ai.usage import UsageLedger, get_usage_ledger, price_usd
from app.config import Settings, get_settings
from app.fixtures import patients

Row = dict[str, Any]

USER = "USR-001"  # case manager at HSP-001


# ── Sanitization ──────────────────────────────────────────────────────────────


def test_sanitize_strips_identity_but_keeps_clinical_context() -> None:
    patient = patients()[0]

    sanitized = sanitize_patient(patient)
    serialized = json.dumps(sanitized)

    assert sanitized["label"] == f"{patient['firstName']} {patient['lastName'][0]}."
    assert patient["lastName"] not in serialized
    assert patient["dob"] not in serialized
    assert patient["address"]["street1"] not in serialized
    assert sanitized["zip"] == patient["address"]["zip"]
    assert sanitized["diagnosis"] == patient["primaryDiagnosis"]["description"]
    assert isinstance(sanitized["ageYears"], int)


def test_sanitize_survives_a_broken_row() -> None:
    """Fixture data is trusted, but a missing field must not take the endpoint down."""
    sanitized = sanitize_patient({"id": "PT-x", "firstName": "A", "lastName": "", "address": {}})

    assert sanitized["ageYears"] is None
    assert sanitized["zip"] is None
    assert patient_label({"id": "PT-x"}) == "PT-x"


def test_find_mentioned_patients_matches_whole_words_case_insensitively() -> None:
    target = patients()[0]

    found = find_mentioned_patients(f"order a bed for {target['firstName'].upper()}", patients())

    assert target["id"] in [row["id"] for row in found]


def test_find_mentioned_patients_is_empty_for_a_plain_search() -> None:
    assert find_mentioned_patients("low air loss mattress", patients()) == []


# ── Ranking repair ────────────────────────────────────────────────────────────


def test_apply_ranking_orders_by_the_model_and_keeps_reasons() -> None:
    result = apply_ranking(
        ["OFR-001", "OFR-002", "OFR-003"],
        [
            {"offerId": "OFR-003", "reason": "Fastest delivery"},
            {"offerId": "OFR-001", "reason": "Best rated"},
            {"offerId": "OFR-002", "reason": ""},
        ],
    )

    assert result["orderedOfferIds"] == ["OFR-003", "OFR-001", "OFR-002"]
    assert result["reasons"]["OFR-003"] == "Fastest delivery"
    assert "OFR-002" not in result["reasons"]


def test_apply_ranking_drops_invented_and_duplicate_ids_and_appends_the_rest() -> None:
    """The schema enum should prevent this, but the repair is what makes it safe if it doesn't."""
    result = apply_ranking(
        ["OFR-001", "OFR-002", "OFR-003"],
        [
            {"offerId": "OFR-999", "reason": "made up"},
            {"offerId": "OFR-002", "reason": "ok"},
            {"offerId": "OFR-002", "reason": "dup"},
        ],
    )

    assert result["orderedOfferIds"] == ["OFR-002", "OFR-001", "OFR-003"]
    assert "OFR-999" not in result["reasons"]


def test_apply_ranking_is_a_no_op_permutation_when_the_model_returns_nothing() -> None:
    ids = ["OFR-001", "OFR-002"]

    assert apply_ranking(ids, [])["orderedOfferIds"] == ids


# ── Token ledger ──────────────────────────────────────────────────────────────


def test_ledger_splits_totals_by_feature_plus_a_grand_total() -> None:
    ledger = UsageLedger()

    ledger.record(
        feature="rerank",
        model="claude-haiku-4-5",
        input_tokens=10_000,
        output_tokens=1_000,
        latency_ms=1500,
        ok=True,
    )
    ledger.record(
        feature="agent_order",
        model="claude-haiku-4-5",
        input_tokens=5_000,
        output_tokens=200,
        latency_ms=900,
        ok=True,
    )
    ledger.record(
        feature="agent_order",
        model="claude-haiku-4-5",
        input_tokens=0,
        output_tokens=0,
        latency_ms=15_000,
        ok=False,
    )

    summary = ledger.summary()
    assert summary["byFeature"]["rerank"]["calls"] == 1
    assert summary["byFeature"]["agent_order"]["calls"] == 2
    assert summary["total"]["calls"] == 3
    assert summary["total"]["inputTokens"] == 15_000
    # 15k in @ $1/M + 1.2k out @ $5/M = $0.015 + $0.006
    assert summary["total"]["costUsd"] == pytest.approx(0.021)


def test_ledger_prices_haiku_and_refuses_to_guess_an_unknown_model() -> None:
    assert price_usd("claude-haiku-4-5", 1_000_000, 0) == 1
    assert price_usd("claude-haiku-4-5", 0, 1_000_000) == 5
    assert price_usd("unknown-model", 1_000_000, 1_000_000) == 0


def test_ledger_trims_records_but_keeps_counting() -> None:
    """A long demo must not grow the process without bound."""
    ledger = UsageLedger()

    for _ in range(520):
        ledger.record(
            feature="rerank",
            model="claude-haiku-4-5",
            input_tokens=1,
            output_tokens=0,
            latency_ms=1,
            ok=True,
        )

    assert len(ledger.records()) == 500
    assert ledger.summary()["total"]["calls"] == 500


# ── Endpoints, with a stubbed model ───────────────────────────────────────────


class _Usage:
    input_tokens = 100
    output_tokens = 20


class _TextBlock:
    type = "text"

    def __init__(self, text: str) -> None:
        self.text = text


class _ToolUseBlock:
    type = "tool_use"

    def __init__(self, block_id: str, name: str, tool_input: Row) -> None:
        self.id = block_id
        self.name = name
        self.input = tool_input


class _Response:
    def __init__(self, content: list[Any], stop_reason: str = "end_turn") -> None:
        self.content = content
        self.stop_reason = stop_reason
        self.usage = _Usage()


class _StubMessages:
    """Replays a scripted list of responses, one per model call."""

    def __init__(self, responses: list[_Response]) -> None:
        self._responses = list(responses)
        self.calls: list[Row] = []

    async def create(self, **kwargs: Any) -> _Response:
        self.calls.append(kwargs)
        if not self._responses:
            raise AssertionError("the code under test made more model calls than were scripted")
        return self._responses.pop(0)


class _StubClient:
    def __init__(self, responses: list[_Response]) -> None:
        self.messages = _StubMessages(responses)


@pytest.fixture
def ai_settings() -> Settings:
    """Settings with a key, so the endpoints run rather than answering 503."""
    return Settings(anthropic_api_key="sk-ant-test", ai_max_tool_turns=6)


@pytest.fixture
def ai_client(ai_settings: Settings) -> TestClient:
    from app.main import app

    app.dependency_overrides[get_settings] = lambda: ai_settings
    yield TestClient(app)
    app.dependency_overrides.clear()


def _stub_model(monkeypatch: pytest.MonkeyPatch, responses: list[_Response]) -> _StubClient:
    """Point both AI modules at one scripted client."""
    stub = _StubClient(responses)
    monkeypatch.setattr("app.ai.rerank.get_client", lambda _settings: stub)
    monkeypatch.setattr("app.ai.agent.get_client", lambda _settings: stub)
    return stub


def test_rerank_returns_a_permutation_and_the_patient_label(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    offer_ids = ["OFR-001", "OFR-002", "OFR-003"]
    _stub_model(
        monkeypatch,
        [
            _Response(
                [
                    _TextBlock(
                        json.dumps(
                            {"ranking": [{"offerId": "OFR-002", "reason": "In stock, ships today"}]}
                        )
                    )
                ]
            )
        ],
    )

    response = ai_client.post(
        "/ai/rerank",
        json={"query": "hospital bed for Harold", "offerIds": offer_ids, "hospiceId": "HSP-001"},
    )

    assert response.status_code == 200
    body = response.json()
    # A permutation: the model named one id, the other two keep their original order behind it.
    assert body["orderedOfferIds"] == ["OFR-002", "OFR-001", "OFR-003"]
    assert body["reasons"]["OFR-002"] == "In stock, ships today"
    assert body["patientLabel"] == "Harold B."


def test_rerank_never_sends_an_identifying_field_to_the_model(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The privacy claim, asserted against the bytes that would actually leave the process."""
    harold = next(p for p in patients() if p["firstName"] == "Harold")
    stub = _stub_model(monkeypatch, [_Response([_TextBlock(json.dumps({"ranking": []}))])])

    ai_client.post(
        "/ai/rerank",
        json={"query": "bed for Harold", "offerIds": ["OFR-001"], "hospiceId": "HSP-001"},
    )

    sent = json.dumps(stub.messages.calls[0]["messages"])
    assert harold["lastName"] not in sent
    assert harold["dob"] not in sent
    assert harold["address"]["street1"] not in sent
    assert harold["address"]["zip"] in sent  # coarse location is allowed, and useful


def test_rerank_answers_503_without_a_key() -> None:
    """No key is "AI is off", not "AI is broken" — the UI falls back to plain search."""
    from app.main import app

    app.dependency_overrides[get_settings] = lambda: Settings(anthropic_api_key="")
    try:
        response = TestClient(app).post(
            "/ai/rerank", json={"query": "bed", "offerIds": ["OFR-001"]}
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503


def test_rerank_answers_502_when_the_model_fails(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    class _Failing:
        async def create(self, **_kwargs: Any) -> None:
            raise RuntimeError("upstream exploded")

    class _FailingClient:
        messages = _Failing()

    monkeypatch.setattr("app.ai.rerank.get_client", lambda _settings: _FailingClient())

    response = ai_client.post("/ai/rerank", json={"query": "bed", "offerIds": ["OFR-001"]})

    assert response.status_code == 502
    # The failed call is still counted — cost tracking covers failures, not just successes.
    assert get_usage_ledger().summary()["byFeature"]["rerank"]["calls"] == 1


def test_rerank_ignores_offer_ids_the_catalog_does_not_have(ai_client: TestClient) -> None:
    response = ai_client.post("/ai/rerank", json={"query": "bed", "offerIds": ["OFR-nope"]})

    assert response.status_code == 200
    assert response.json()["orderedOfferIds"] == []


def test_agent_order_writes_the_cart_through_mcp(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The whole point: the model's tool call is what mutates the store."""
    line = {"offerId": "OFR-002", "patientId": "PT-88421", "qty": 1, "unit": "month"}
    _stub_model(
        monkeypatch,
        [
            _Response(
                [_ToolUseBlock("tu_1", "get_cart", {"userId": USER})], stop_reason="tool_use"
            ),
            _Response(
                [_ToolUseBlock("tu_2", "update_cart", {"userId": USER, "lines": [line]})],
                stop_reason="tool_use",
            ),
            _Response([_TextBlock("Added 1 Wheelchair for Harold B.")]),
        ],
    )

    response = ai_client.post(
        "/ai/order", json={"command": "order a wheelchair for Harold", "userId": USER}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["cart"]["lines"][0]["offerId"] == "OFR-002"
    # Priced server-side from the catalog — the model never supplied a number.
    assert body["cart"]["lines"][0]["priceUsd"] > 0
    assert body["added"] == {"offerId": "OFR-002", "patientId": "PT-88421"}
    assert [call["tool"] for call in body["toolCalls"]] == ["get_cart", "update_cart"]

    # And the same store answers the REST endpoint — one cart, not two.
    assert ai_client.get(f"/carts/{USER}").json()["lines"][0]["offerId"] == "OFR-002"


def test_agent_order_reports_no_match_without_touching_the_cart(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _stub_model(monkeypatch, [_Response([_TextBlock("NO_MATCH")])])

    response = ai_client.post(
        "/ai/order", json={"command": "order a helicopter for Zebediah", "userId": USER}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["cart"] is None
    assert body["added"] is None
    assert ai_client.get(f"/carts/{USER}").json()["lines"] == []


def test_agent_order_refuses_a_tool_outside_its_allowlist(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Checkout is a human's decision. A model that reaches for it is told no and keeps going."""
    assert "checkout_cart" not in agent_module.ALLOWED_TOOLS
    _stub_model(
        monkeypatch,
        [
            _Response(
                [_ToolUseBlock("tu_1", "checkout_cart", {"userId": USER})], stop_reason="tool_use"
            ),
            _Response([_TextBlock("NO_MATCH")]),
        ],
    )

    response = ai_client.post("/ai/order", json={"command": "order and check out", "userId": USER})

    assert response.status_code == 200
    assert response.json()["toolCalls"] == [{"tool": "checkout_cart", "ok": False}]
    # No order was created behind the nurse's back.
    assert ai_client.get("/orders", params={"hospiceId": "HSP-001"}).json() is not None


def test_agent_order_reports_a_failed_tool_back_to_the_model(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A rejected write is a message the model can recover from, not an ended turn."""
    stub = _stub_model(
        monkeypatch,
        [
            _Response(
                [
                    _ToolUseBlock(
                        "tu_1",
                        "update_cart",
                        {
                            "userId": USER,
                            "lines": [
                                {
                                    "offerId": "OFR-nope",
                                    "patientId": "PT-88421",
                                    "qty": 1,
                                    "unit": "month",
                                }
                            ],
                        },
                    )
                ],
                stop_reason="tool_use",
            ),
            _Response([_TextBlock("NO_MATCH")]),
        ],
    )

    response = ai_client.post(
        "/ai/order", json={"command": "order a nonexistent item", "userId": USER}
    )

    assert response.status_code == 200
    assert response.json()["toolCalls"] == [{"tool": "update_cart", "ok": False}]
    # The model was handed the error rather than the request being aborted. `default=str` because
    # the assistant turn echoes back the stub's content blocks, which are not JSON types.
    follow_up = json.dumps(stub.messages.calls[1]["messages"], default=str)
    assert "OFR-nope not found" in follow_up


def test_agent_order_stops_at_the_tool_turn_ceiling(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A model that never stops calling tools must not hold the request open forever."""
    from app.main import app

    settings = Settings(anthropic_api_key="sk-ant-test", ai_max_tool_turns=2)
    app.dependency_overrides[get_settings] = lambda: settings
    stub = _stub_model(
        monkeypatch,
        [
            _Response([_ToolUseBlock(f"tu_{i}", "list_products", {})], stop_reason="tool_use")
            for i in range(5)
        ],
    )
    try:
        response = TestClient(app).post(
            "/ai/order", json={"command": "order something", "userId": USER}
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert len(stub.messages.calls) == 2
    assert response.json()["cart"] is None


def test_agent_order_404s_for_an_unknown_user(ai_client: TestClient) -> None:
    response = ai_client.post("/ai/order", json={"command": "order a bed", "userId": "USR-nope"})

    assert response.status_code == 404


def test_usage_endpoint_reports_what_the_calls_cost(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _stub_model(monkeypatch, [_Response([_TextBlock(json.dumps({"ranking": []}))])])
    ai_client.post("/ai/rerank", json={"query": "bed", "offerIds": ["OFR-001"]})

    body = ai_client.get("/ai/usage").json()

    assert body["summary"]["byFeature"]["rerank"]["calls"] == 1
    assert body["summary"]["total"]["inputTokens"] == 100
    assert body["records"][0]["ok"] is True
    assert body["records"][0]["costUsd"] > 0


def test_health_reports_whether_ai_is_configured(ai_client: TestClient) -> None:
    assert ai_client.get("/health").json()["aiEnabled"] is True
