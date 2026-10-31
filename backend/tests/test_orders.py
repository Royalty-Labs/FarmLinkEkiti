from test_farmer_workflow import (
    approve_profile_for_products,
    create_admin,
    create_profile,
    login_existing,
    product_payload,
    register_and_login,
    workflow,
)


def create_marketplace(client, session_factory):
    """Create an approved farmer, a product listing, and a buyer."""
    farmer_headers = register_and_login(
        client, "orders-farmer@example.com", "farmer"
    )

    profile = create_profile(client, farmer_headers)
    assert profile.status_code == 201, profile.text

    create_admin(session_factory)
    admin_headers = login_existing(client, "admin@example.com")
    approve_profile_for_products(
        client, admin_headers, profile.json()["id"]
    )

    product_response = client.post(
        "/products",
        headers=farmer_headers,
        json=product_payload(),
    )
    assert product_response.status_code == 201, product_response.text

    buyer_headers = register_and_login(
        client, "orders-buyer@example.com", "buyer"
    )

    return farmer_headers, buyer_headers, product_response.json()


def place_order(client, buyer_headers, product_id, **overrides):
    payload = {
        "product_id": product_id,
        "quantity": "2.50",
        "delivery_address": "12 Market Road, Ado-Ekiti",
        "buyer_note": "Please deliver fresh produce.",
    }
    payload.update(overrides)

    return client.post(
        "/orders",
        headers=buyer_headers,
        json=payload,
    )


def get_stock(client, product_id):
    response = client.get(f"/products/{product_id}")
    assert response.status_code == 200, response.text
    return float(response.json()["quantity_available"])


def test_buyer_can_order_product_and_stock_decreases(workflow):
    client, session_factory = workflow
    farmer_headers, buyer_headers, product = create_marketplace(
        client, session_factory
    )

    response = place_order(
        client, buyer_headers, product["id"], quantity="2.50"
    )

    assert response.status_code == 201, response.text
    order = response.json()
    assert order["product_id"] == product["id"]
    assert order["product_name"] == "Fresh Tomatoes"
    assert order["unit"] == "kg"
    assert float(order["quantity"]) == 2.5
    assert float(order["unit_price"]) == 1500.0
    assert float(order["total_price"]) == 3750.0
    assert order["status"] == "pending"
    assert order["delivery_address"] == "12 Market Road, Ado-Ekiti"
    assert get_stock(client, product["id"]) == 22.5

    buyer_orders = client.get("/orders/mine", headers=buyer_headers)
    farmer_orders = client.get("/orders/farmer", headers=farmer_headers)

    assert buyer_orders.status_code == 200
    assert [item["id"] for item in buyer_orders.json()] == [order["id"]]
    assert farmer_orders.status_code == 200
    assert [item["id"] for item in farmer_orders.json()] == [order["id"]]


def test_order_cannot_exceed_available_stock(workflow):
    client, session_factory = workflow
    _, buyer_headers, product = create_marketplace(client, session_factory)

    response = place_order(
        client, buyer_headers, product["id"], quantity="26"
    )

    assert response.status_code == 409
    assert get_stock(client, product["id"]) == 25.0
    assert client.get("/orders/mine", headers=buyer_headers).json() == []


def test_order_rejects_zero_quantity(workflow):
    client, session_factory = workflow
    _, buyer_headers, product = create_marketplace(client, session_factory)

    response = place_order(
        client, buyer_headers, product["id"], quantity="0"
    )

    assert response.status_code == 422
    assert get_stock(client, product["id"]) == 25.0


def test_farmer_can_accept_and_prepare_order_for_fulfillment(workflow):
    client, session_factory = workflow
    farmer_headers, buyer_headers, product = create_marketplace(
        client, session_factory
    )

    created = place_order(client, buyer_headers, product["id"])
    assert created.status_code == 201, created.text
    order_id = created.json()["id"]

    accepted = client.patch(
        f"/orders/{order_id}/status",
        headers=farmer_headers,
        json={"status": "accepted"},
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "accepted"

    ready = client.patch(
        f"/orders/{order_id}/status",
        headers=farmer_headers,
        json={"status": "ready_for_fulfillment"},
    )
    assert ready.status_code == 200, ready.text
    assert ready.json()["status"] == "ready_for_fulfillment"

    completed = client.patch(
        f"/orders/{order_id}/status",
        headers=buyer_headers,
        json={"status": "completed"},
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"

    # Stock was reserved when the order was placed, not deducted again.
    assert get_stock(client, product["id"]) == 22.5


def test_farmer_rejection_requires_reason_and_restores_stock(workflow):
    client, session_factory = workflow
    farmer_headers, buyer_headers, product = create_marketplace(
        client, session_factory
    )

    created = place_order(client, buyer_headers, product["id"])
    assert created.status_code == 201, created.text
    order_id = created.json()["id"]
    assert get_stock(client, product["id"]) == 22.5

    missing_reason = client.patch(
        f"/orders/{order_id}/status",
        headers=farmer_headers,
        json={"status": "rejected"},
    )
    assert missing_reason.status_code == 422

    rejected = client.patch(
        f"/orders/{order_id}/status",
        headers=farmer_headers,
        json={
            "status": "rejected",
            "rejection_reason": "The requested quantity is unavailable.",
        },
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["rejection_reason"] == (
        "The requested quantity is unavailable."
    )
    assert get_stock(client, product["id"]) == 25.0

    # A rejected order cannot be rejected a second time to restore stock again.
    repeated = client.patch(
        f"/orders/{order_id}/status",
        headers=farmer_headers,
        json={
            "status": "rejected",
            "rejection_reason": "Another reason.",
        },
    )
    assert repeated.status_code == 409
    assert get_stock(client, product["id"]) == 25.0


def test_buyer_can_cancel_pending_order_and_stock_is_restored(workflow):
    client, session_factory = workflow
    _, buyer_headers, product = create_marketplace(client, session_factory)

    created = place_order(client, buyer_headers, product["id"])
    assert created.status_code == 201, created.text
    order_id = created.json()["id"]
    assert get_stock(client, product["id"]) == 22.5

    cancelled = client.patch(
        f"/orders/{order_id}/status",
        headers=buyer_headers,
        json={"status": "cancelled"},
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"
    assert get_stock(client, product["id"]) == 25.0

    repeated = client.patch(
        f"/orders/{order_id}/status",
        headers=buyer_headers,
        json={"status": "cancelled"},
    )
    assert repeated.status_code == 409
    assert get_stock(client, product["id"]) == 25.0


def test_users_cannot_access_or_update_another_users_order(workflow):
    client, session_factory = workflow
    farmer_headers, buyer_headers, product = create_marketplace(
        client, session_factory
    )

    created = place_order(client, buyer_headers, product["id"])
    assert created.status_code == 201, created.text
    order_id = created.json()["id"]

    other_buyer_headers = register_and_login(
        client, "other-orders-buyer@example.com", "buyer"
    )
    other_buyer_orders = client.get(
        "/orders/mine", headers=other_buyer_headers
    )
    assert other_buyer_orders.status_code == 200
    assert other_buyer_orders.json() == []

    buyer_attempt = client.patch(
        f"/orders/{order_id}/status",
        headers=other_buyer_headers,
        json={"status": "cancelled"},
    )
    assert buyer_attempt.status_code == 404

    other_farmer_headers = register_and_login(
        client, "other-orders-farmer@example.com", "farmer"
    )
    farmer_attempt = client.patch(
        f"/orders/{order_id}/status",
        headers=other_farmer_headers,
        json={"status": "accepted"},
    )
    assert farmer_attempt.status_code == 404

    # A farmer cannot cancel an order using a buyer-only transition.
    farmer_cancel = client.patch(
        f"/orders/{order_id}/status",
        headers=farmer_headers,
        json={"status": "cancelled"},
    )
    assert farmer_cancel.status_code == 409

    # The real buyer and farmer still have access to their order.
    assert len(client.get("/orders/mine", headers=buyer_headers).json()) == 1
    assert len(client.get("/orders/farmer", headers=farmer_headers).json()) == 1


def test_buyer_cannot_create_orders_and_farmer_cannot_list_buyer_orders(workflow):
    client, session_factory = workflow
    farmer_headers, buyer_headers, product = create_marketplace(
        client, session_factory
    )

    farmer_attempt = place_order(
        client, farmer_headers, product["id"]
    )
    assert farmer_attempt.status_code == 403

    buyer_attempt = client.get("/orders/farmer", headers=buyer_headers)
    assert buyer_attempt.status_code == 403

    assert get_stock(client, product["id"]) == 25.0
