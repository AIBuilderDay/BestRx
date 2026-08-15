"""Cart endpoints: contents, pricing, and the checkout split."""

from __future__ import annotations

from fastapi.testclient import TestClient

USER = "USR-001"  # case manager at HSP-001
PATIENT_A = "PT-88421"
PATIENT_B = "PT-88502"
# OFR-001 and OFR-002 are both VND-001; OFR-001 is a purchase, OFR-002 a monthly rental.
OFFER_V1_PURCHASE = "OFR-001"
OFFER_V1_RENTAL = "OFR-002"
OFFER_BOTH = "OFR-003"  # wheelchair Vendor 1 both rents and sells
OFFER_PURCHASE_ONLY = "OFR-005"  # walker: sold outright, never rented


def _offer_from_other_vendor(client: TestClient) -> str:
    """An offer from a vendor other than VND-001, so checkout has something to split on."""
    offers = client.get("/products").json()
    return next(o["id"] for o in offers if o["vendorId"] != "VND-001")


def test_get_cart_creates_an_empty_one(client: TestClient) -> None:
    body = client.get(f"/carts/{USER}").json()

    assert body["userId"] == USER
    assert body["hospiceId"] == "HSP-001"
    assert body["lines"] == []
    assert body["totals"]["unitCount"] == 0


def test_get_cart_rejects_an_unknown_user(client: TestClient) -> None:
    assert client.get("/carts/USR-nope").status_code == 404


def test_create_cart_prices_lines_from_the_catalog(client: TestClient) -> None:
    response = client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [{"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_A, "qty": 2}],
        },
    )
    assert response.status_code == 201

    line = response.json()["lines"][0]
    assert line["priceUsd"] == 124.5
    assert line["lineTotalUsd"] == 249.0
    assert line["productName"] == "Oxygen Concentrator"


def test_totals_keep_rentals_and_purchases_apart(client: TestClient) -> None:
    body = client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [
                {"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_A, "unit": "month", "qty": 1},
                {"offerId": OFFER_V1_PURCHASE, "patientId": PATIENT_A, "unit": "purchase", "qty": 1},
            ],
        },
    ).json()

    assert body["totals"]["monthlyUsd"] == 124.5
    assert body["totals"]["oneTimeUsd"] == 1045.0
    assert body["totals"]["firstMonthUsd"] == 1169.5


def test_renting_and_buying_one_offer_are_separate_lines(client: TestClient) -> None:
    """Unit is part of line identity: renting one wheelchair and buying another is two lines."""
    body = client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [
                {"offerId": OFFER_BOTH, "patientId": PATIENT_A, "unit": "month", "qty": 1},
                {"offerId": OFFER_BOTH, "patientId": PATIENT_A, "unit": "purchase", "qty": 1},
            ],
        },
    ).json()

    assert len(body["lines"]) == 2
    assert {line["unit"] for line in body["lines"]} == {"month", "purchase"}
    assert body["totals"]["monthlyUsd"] == 70.0
    assert body["totals"]["oneTimeUsd"] == 280.0


def test_renting_an_offer_that_is_only_sold_is_rejected(client: TestClient) -> None:
    """A walker has no rental rate. Asking to rent one is a client error, not a silent $0 line."""
    response = client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [{"offerId": OFFER_PURCHASE_ONLY, "patientId": PATIENT_A, "unit": "month", "qty": 1}],
        },
    )
    assert response.status_code == 422


def test_checkout_carries_the_unit_onto_the_order(client: TestClient) -> None:
    """One order may hold both a rented and a bought line: unit does not split orders."""
    client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [
                {"offerId": OFFER_BOTH, "patientId": PATIENT_A, "unit": "month", "qty": 1},
                {"offerId": OFFER_BOTH, "patientId": PATIENT_A, "unit": "purchase", "qty": 1},
            ],
        },
    )
    orders = client.post(f"/carts/{USER}/checkout", json={"urgency": "routine"}).json()["orders"]

    assert len(orders) == 1
    equipment = orders[0]["equipment"]
    assert len(equipment) == 2
    assert {item["unit"] for item in equipment} == {"month", "purchase"}


def test_duplicate_lines_merge_rather_than_double_count(client: TestClient) -> None:
    body = client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [
                {"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_A, "qty": 1},
                {"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_A, "qty": 3},
            ],
        },
    ).json()

    assert len(body["lines"]) == 1
    assert body["lines"][0]["qty"] == 4


def test_the_same_offer_for_two_patients_stays_two_lines(client: TestClient) -> None:
    body = client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [
                {"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_A, "qty": 1},
                {"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_B, "qty": 1},
            ],
        },
    ).json()

    assert len(body["lines"]) == 2


def test_update_replaces_the_whole_line_list(client: TestClient) -> None:
    client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [{"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_A, "qty": 5}],
        },
    )

    body = client.put(
        f"/carts/{USER}",
        json={"lines": [{"offerId": OFFER_V1_PURCHASE, "patientId": PATIENT_B, "qty": 1}]},
    ).json()

    assert len(body["lines"]) == 1
    assert body["lines"][0]["offerId"] == OFFER_V1_PURCHASE
    assert client.get(f"/carts/{USER}").json()["lines"][0]["offerId"] == OFFER_V1_PURCHASE


def test_update_on_a_missing_cart_creates_it(client: TestClient) -> None:
    response = client.put(
        f"/carts/{USER}",
        json={"lines": [{"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_A, "qty": 1}]},
    )

    assert response.status_code == 200
    assert response.json()["totals"]["unitCount"] == 1


def test_unknown_offer_and_patient_are_rejected(client: TestClient) -> None:
    bad_offer = client.post(
        "/carts",
        json={"userId": USER, "lines": [{"offerId": "OFR-nope", "patientId": PATIENT_A, "qty": 1}]},
    )
    bad_patient = client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [{"offerId": OFFER_V1_RENTAL, "patientId": "PT-0", "qty": 1}],
        },
    )

    assert bad_offer.status_code == 422
    assert bad_patient.status_code == 422


def test_a_zero_quantity_line_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [{"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_A, "qty": 0}],
        },
    )
    assert response.status_code == 422


def test_delete_empties_the_cart(client: TestClient) -> None:
    client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [{"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_A, "qty": 1}],
        },
    )

    assert client.delete(f"/carts/{USER}").status_code == 204
    assert client.get(f"/carts/{USER}").json()["lines"] == []


def test_checkout_splits_by_patient_and_vendor(client: TestClient) -> None:
    other_vendor_offer = _offer_from_other_vendor(client)
    client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [
                {"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_A, "qty": 1},
                {"offerId": OFFER_V1_PURCHASE, "patientId": PATIENT_A, "qty": 1},
                {"offerId": other_vendor_offer, "patientId": PATIENT_A, "qty": 1},
                {"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_B, "qty": 1},
            ],
        },
    )

    response = client.post(f"/carts/{USER}/checkout", json={"urgency": "urgent"})
    assert response.status_code == 201

    orders = response.json()["orders"]
    # PATIENT_A/VND-001, PATIENT_A/other vendor, PATIENT_B/VND-001.
    assert len(orders) == 3

    a_vnd1 = next(o for o in orders if o["patientId"] == PATIENT_A and o["vendorId"] == "VND-001")
    assert {e["hcpcs"] for e in a_vnd1["equipment"]} == {"E1390", "E0250"}
    assert all(o["status"] == "ordered" for o in orders)
    assert all(o["urgency"] == "urgent" for o in orders)
    assert all(o["orderedById"] == USER for o in orders)
    assert all(o["hospiceId"] == "HSP-001" for o in orders)
    assert all(o["canonical"] is False for o in orders)


def test_checkout_empties_the_cart_and_persists_the_orders(client: TestClient) -> None:
    client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [{"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_A, "qty": 2}],
        },
    )

    order_id = client.post(f"/carts/{USER}/checkout", json={}).json()["orderIds"][0]

    assert client.get(f"/carts/{USER}").json()["lines"] == []
    assert client.get(f"/orders/{order_id}").json()["order"]["equipment"][0]["qty"] == 2


def test_checkout_opens_the_order_timeline(client: TestClient) -> None:
    client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [{"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_A, "qty": 1}],
        },
    )
    order_id = client.post(f"/carts/{USER}/checkout", json={}).json()["orderIds"][0]

    events = client.get(f"/orders/{order_id}").json()["events"]
    assert [e["event"] for e in events] == ["ordered"]


def test_checkout_of_an_empty_cart_is_a_conflict(client: TestClient) -> None:
    client.get(f"/carts/{USER}")  # creates the empty cart
    assert client.post(f"/carts/{USER}/checkout", json={}).status_code == 409


def test_checkout_without_a_cart_is_a_404(client: TestClient) -> None:
    assert client.post(f"/carts/{USER}/checkout", json={}).status_code == 404


def test_carts_are_isolated_between_users(client: TestClient) -> None:
    client.post(
        "/carts",
        json={
            "userId": USER,
            "lines": [{"offerId": OFFER_V1_RENTAL, "patientId": PATIENT_A, "qty": 1}],
        },
    )

    assert client.get("/carts/USR-002").json()["lines"] == []
    assert len(client.get(f"/carts/{USER}").json()["lines"]) == 1


def test_cors_preflight_allows_every_method_the_client_uses(client: TestClient) -> None:
    """A browser preflights PUT before sending it.

    PUT was missing from the CORS allow-list until carts needed it, which failed in the browser
    while passing every curl test — curl does not preflight. Assert the whole set, not just PUT.
    """
    for method in ("GET", "POST", "PUT", "PATCH", "DELETE"):
        response = client.options(
            f"/carts/{USER}",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200, f"{method} preflight rejected: {response.text}"
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
