"""HTTP surface: the endpoints the frontend actually calls."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_health_reports_wiring(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "ok"
    assert body["pushEnabled"] is False
    assert body["subscriptionsPersisted"] is False
    assert body["streamClients"] == 0


def test_list_orders(client: TestClient) -> None:
    response = client.get("/orders")
    assert response.status_code == 200

    orders = response.json()
    assert len(orders) > 0
    assert {"id", "status", "patientId"} <= orders[0].keys()


def test_list_orders_filters_by_hospice(client: TestClient) -> None:
    response = client.get("/orders", params={"hospiceId": "HSP-001"})
    assert response.status_code == 200
    assert all(order["hospiceId"] == "HSP-001" for order in response.json())


def test_get_order_includes_timeline(client: TestClient) -> None:
    order_id = client.get("/orders").json()[0]["id"]

    response = client.get(f"/orders/{order_id}")
    assert response.status_code == 200

    body = response.json()
    assert body["order"]["id"] == order_id
    assert isinstance(body["events"], list)


def test_get_missing_order_is_404(client: TestClient) -> None:
    assert client.get("/orders/DME-00000").status_code == 404


def test_patch_status_advances_the_order(client: TestClient) -> None:
    ordered = [o for o in client.get("/orders").json() if o["status"] == "ordered"][0]

    response = client.patch(
        f"/orders/{ordered['id']}/status",
        json={"status": "dispatched", "actorId": "USR-001"},
    )
    assert response.status_code == 200

    body = response.json()
    assert body["order"]["status"] == "dispatched"
    assert body["event"]["event"] == "dispatched"


def test_patch_invalid_transition_is_409_with_options(client: TestClient) -> None:
    ordered = [o for o in client.get("/orders").json() if o["status"] == "ordered"][0]

    response = client.patch(f"/orders/{ordered['id']}/status", json={"status": "delivered"})
    assert response.status_code == 409

    detail = response.json()["detail"]
    assert detail["currentStatus"] == "ordered"
    assert detail["allowedNext"] == ["dispatched"]


def test_patch_unknown_status_is_422(client: TestClient) -> None:
    ordered = [o for o in client.get("/orders").json() if o["status"] == "ordered"][0]
    response = client.patch(f"/orders/{ordered['id']}/status", json={"status": "exploded"})
    assert response.status_code == 422


def test_patch_missing_order_is_404(client: TestClient) -> None:
    response = client.patch("/orders/DME-00000/status", json={"status": "dispatched"})
    assert response.status_code == 404


def test_create_order(client: TestClient) -> None:
    patient_id = client.get("/patients").json()[0]["id"]

    response = client.post(
        "/orders",
        json={
            "patientId": patient_id,
            "hospiceId": "HSP-001",
            "vendorId": "VND-001",
            "orderedById": "USR-001",
            "equipment": [{"hcpcs": "E0250", "name": "Hospital Bed", "qty": 1}],
            "notes": "Created by a test.",
        },
    )
    assert response.status_code == 201

    order = response.json()
    assert order["status"] == "ordered"
    assert order["canonical"] is False
    assert client.get(f"/orders/{order['id']}").status_code == 200


def test_create_order_rejects_empty_equipment(client: TestClient) -> None:
    patient_id = client.get("/patients").json()[0]["id"]
    response = client.post(
        "/orders",
        json={"patientId": patient_id, "hospiceId": "HSP-001", "equipment": []},
    )
    assert response.status_code == 422


def test_create_order_rejects_unknown_patient(client: TestClient) -> None:
    response = client.post(
        "/orders",
        json={
            "patientId": "PT-00000",
            "hospiceId": "HSP-001",
            "equipment": [{"hcpcs": "E0250", "name": "Hospital Bed", "qty": 1}],
        },
    )
    assert response.status_code == 422


def test_patients_products_and_equipment_are_served(client: TestClient) -> None:
    for path in ("/patients", "/products", "/equipment", "/vendors"):
        response = client.get(path)
        assert response.status_code == 200, path
        assert len(response.json()) > 0, path


def test_every_table_the_frontend_boots_from_is_served(client: TestClient) -> None:
    """The frontend loads these at startup and has no fixture fallback; a 404 blanks the app."""
    for path in (
        "/equipment",
        "/hospices",
        "/vendors",
        "/users",
        "/patients",
        "/orders",
        "/orders/events/all",
        "/inventory",
        "/emr-events",
        "/products",
        "/reviews",
        "/budgets",
    ):
        response = client.get(path)
        assert response.status_code == 200, path
        assert len(response.json()) > 0, path


def test_all_events_is_not_shadowed_by_the_order_id_route(client: TestClient) -> None:
    # /orders/{order_id} would swallow "events" if it were declared first.
    events = client.get("/orders/events/all").json()
    assert isinstance(events, list)
    assert all("orderId" in event for event in events)


def test_real_vendors_are_served_and_sourced(client: TestClient) -> None:
    response = client.get("/real-vendors")
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) > 0
    # Every row must name where it came from — these are real companies, not simulated ones.
    assert all(row["sourceUrl"] and row["sourceRetrieved"] for row in rows)


def test_real_vendors_filter_by_state(client: TestClient) -> None:
    response = client.get("/real-vendors", params={"state": "UT"})
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) > 0
    for row in rows:
        in_ut = (
            "UT" in (row.get("statesServed") or [])
            or (row.get("headquarters") or {}).get("state") == "UT"
            or any(loc["state"] == "UT" for loc in row["locations"])
        )
        assert in_ut, row["id"]


def test_real_vendors_filter_by_hcpcs(client: TestClient) -> None:
    response = client.get("/real-vendors", params={"hcpcs": "E0250"})
    assert response.status_code == 200
    assert all("E0250" in row["hcpcsCarried"] for row in response.json())


def test_real_vendor_by_id_and_404(client: TestClient) -> None:
    assert client.get("/real-vendors/RVND-UT-001").json()["name"] == "Alpine Home Medical"
    assert client.get("/real-vendors/RVND-NOPE").status_code == 404


def test_patients_filter_by_case_manager(client: TestClient) -> None:
    response = client.get("/patients", params={"caseManagerId": "USR-001"})
    assert response.status_code == 200
    assert all(p["caseManagerId"] == "USR-001" for p in response.json())


def test_products_and_equipment_are_different_tables(client: TestClient) -> None:
    """/products is per-vendor pricing; /equipment is the HCPCS catalog."""
    offer = client.get("/products").json()[0]
    catalog_entry = client.get("/equipment").json()[0]

    assert "priceUsd" in offer and "vendorId" in offer
    assert "hcpcs" in catalog_entry and "priceUsd" not in catalog_entry


def test_push_public_key_is_503_when_unconfigured(client: TestClient) -> None:
    assert client.get("/push/public-key").status_code == 503


def test_push_subscribe_and_unsubscribe(client: TestClient) -> None:
    subscription = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
        "keys": {"p256dh": "test-p256dh", "auth": "test-auth"},
        "hospiceId": "HSP-001",
    }

    assert client.post("/push/subscribe", json=subscription).status_code == 201
    assert (
        client.request(
            "DELETE", "/push/subscribe", json={"endpoint": subscription["endpoint"]}
        ).status_code
        == 204
    )
