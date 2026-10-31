import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from uuid import UUID

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import FarmerProfile, User


@pytest.fixture
def workflow(tmp_path):
    database_path = tmp_path / "test_farmer_workflow.db"
    engine = create_engine(
        f"sqlite:///{database_path.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    TestingSessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
    )
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as client:
            yield client, TestingSessionLocal
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def register_and_login(client, email, role):
    response = client.post(
        "/auth/register",
        json={
            "full_name": f"Test {role.title()}",
            "email": email,
            "password": "SecurePass123!",
            "role": role,
        },
    )
    assert response.status_code == 201

    response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": "SecurePass123!",
        },
    )
    assert response.status_code == 200

    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def login_existing(client, email):
    response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": "SecurePass123!",
        },
    )
    assert response.status_code == 200, response.text

    return {
        "Authorization": f"Bearer {response.json()['access_token']}"
    }


def create_admin(session_factory, email="admin@example.com"):
    with session_factory() as db:
        admin = User(
            full_name="Test Administrator",
            email=email,
            password_hash=hash_password("SecurePass123!"),
            role="admin",
        )
        db.add(admin)
        db.commit()


def create_profile(client, headers):
    return client.post(
        "/farmers/me/profile",
        headers=headers,
        json={
            "farm_name": "Green Acres",
            "phone": "08012345678",
            "town": "Ado-Ekiti",
            "address": "Farm Road",
        },
    )


def test_farmer_can_create_pending_profile(workflow):
    client, _ = workflow
    headers = register_and_login(client, "farmer1@example.com", "farmer")

    response = create_profile(client, headers)

    assert response.status_code == 201
    assert response.json()["farm_name"] == "Green Acres"
    assert response.json()["state"] == "Ekiti State"
    assert response.json()["verification_status"] == "pending"
    assert response.json()["rejection_reason"] is None


def test_farmer_can_view_own_profile(workflow):
    client, _ = workflow
    headers = register_and_login(client, "farmer2@example.com", "farmer")
    create_profile(client, headers)

    response = client.get("/farmers/me/profile", headers=headers)

    assert response.status_code == 200
    assert response.json()["farm_name"] == "Green Acres"


def test_farmer_cannot_create_duplicate_profile(workflow):
    client, _ = workflow
    headers = register_and_login(client, "farmer3@example.com", "farmer")
    create_profile(client, headers)

    response = create_profile(client, headers)

    assert response.status_code == 409


def test_buyer_cannot_create_farmer_profile(workflow):
    client, _ = workflow
    headers = register_and_login(client, "buyer1@example.com", "buyer")

    response = create_profile(client, headers)

    assert response.status_code == 403



def test_farmer_cannot_set_required_profile_fields_to_null(workflow):
    client, _ = workflow
    headers = register_and_login(
        client, "null-update-farmer@example.com", "farmer"
    )

    created = create_profile(client, headers)
    assert created.status_code == 201, created.text

    for field in ("farm_name", "phone", "town"):
        response = client.patch(
            "/farmers/me/profile",
            headers=headers,
            json={field: None},
        )
        assert response.status_code == 422, (
            f"Expected null for {field} to be rejected; "
            f"got {response.status_code}: {response.text}"
        )

def test_farmer_update_resubmits_rejected_profile(workflow):
    client, session_factory = workflow
    headers = register_and_login(client, "farmer4@example.com", "farmer")
    created = create_profile(client, headers)
    profile_id = created.json()["id"]

    with session_factory() as db:
        profile = db.get(FarmerProfile, UUID(profile_id))
        profile.verification_status = "rejected"
        profile.rejection_reason = "Please correct your farm details."
        db.commit()

    response = client.patch(
        "/farmers/me/profile",
        headers=headers,
        json={"town": "Ikere-Ekiti"},
    )

    assert response.status_code == 200
    assert response.json()["town"] == "Ikere-Ekiti"
    assert response.json()["verification_status"] == "pending"
    assert response.json()["rejection_reason"] is None


def test_admin_can_list_pending_profiles(workflow):
    client, session_factory = workflow
    farmer_headers = register_and_login(
        client, "farmer5@example.com", "farmer"
    )
    create_profile(client, farmer_headers)

    create_admin(session_factory)
    admin_headers = login_existing(client, "admin@example.com")

    response = client.get(
        "/admin/farmer-profiles?verification_status=pending",
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["verification_status"] == "pending"



def test_admin_lists_oldest_farmer_profiles_first(workflow):
    client, session_factory = workflow

    older_farmer_headers = register_and_login(
        client, "older-farmer@example.com", "farmer"
    )
    older_response = create_profile(client, older_farmer_headers)
    assert older_response.status_code == 201
    older_profile_id = older_response.json()["id"]

    newer_farmer_headers = register_and_login(
        client, "newer-farmer@example.com", "farmer"
    )
    newer_response = create_profile(client, newer_farmer_headers)
    assert newer_response.status_code == 201
    newer_profile_id = newer_response.json()["id"]

    with session_factory() as db:
        older_profile = db.get(FarmerProfile, UUID(older_profile_id))
        newer_profile = db.get(FarmerProfile, UUID(newer_profile_id))

        older_profile.created_at = datetime(2026, 1, 1, 10, 0, 0)
        newer_profile.created_at = datetime(2026, 1, 2, 10, 0, 0)
        db.commit()

    create_admin(session_factory)
    admin_headers = login_existing(client, "admin@example.com")

    response = client.get(
        "/admin/farmer-profiles?verification_status=pending",
        headers=admin_headers,
    )

    assert response.status_code == 200, response.text
    returned_ids = [profile["id"] for profile in response.json()]
    assert returned_ids == [older_profile_id, newer_profile_id]

def test_admin_can_approve_pending_profile(workflow):
    client, session_factory = workflow
    farmer_headers = register_and_login(
        client, "farmer6@example.com", "farmer"
    )
    created = create_profile(client, farmer_headers)
    profile_id = created.json()["id"]

    create_admin(session_factory)
    admin_headers = login_existing(client, "admin@example.com")

    response = client.patch(
        f"/admin/farmer-profiles/{profile_id}/review",
        headers=admin_headers,
        json={"verification_status": "approved"},
    )

    assert response.status_code == 200
    assert response.json()["verification_status"] == "approved"
    assert response.json()["rejection_reason"] is None


def test_admin_rejection_requires_reason(workflow):
    client, session_factory = workflow
    farmer_headers = register_and_login(
        client, "farmer7@example.com", "farmer"
    )
    created = create_profile(client, farmer_headers)
    profile_id = created.json()["id"]

    create_admin(session_factory)
    admin_headers = login_existing(client, "admin@example.com")

    response = client.patch(
        f"/admin/farmer-profiles/{profile_id}/review",
        headers=admin_headers,
        json={"verification_status": "rejected"},
    )

    assert response.status_code == 422


def test_admin_can_reject_profile_with_reason(workflow):
    client, session_factory = workflow
    farmer_headers = register_and_login(
        client, "farmer8@example.com", "farmer"
    )
    created = create_profile(client, farmer_headers)
    profile_id = created.json()["id"]

    create_admin(session_factory)
    admin_headers = login_existing(client, "admin@example.com")

    response = client.patch(
        f"/admin/farmer-profiles/{profile_id}/review",
        headers=admin_headers,
        json={
            "verification_status": "rejected",
            "rejection_reason": "Please provide a more precise farm address.",
        },
    )

    assert response.status_code == 200
    assert response.json()["verification_status"] == "rejected"
    assert response.json()["rejection_reason"] == (
        "Please provide a more precise farm address."
    )


def test_buyer_cannot_access_admin_review(workflow):
    client, session_factory = workflow
    create_admin(session_factory)
    buyer_headers = register_and_login(
        client, "buyer2@example.com", "buyer"
    )

    response = client.get(
        "/admin/farmer-profiles",
        headers=buyer_headers,
    )

    assert response.status_code == 403


def test_admin_cannot_review_profile_twice(workflow):
    client, session_factory = workflow
    farmer_headers = register_and_login(
        client, "farmer9@example.com", "farmer"
    )
    created = create_profile(client, farmer_headers)
    profile_id = created.json()["id"]

    create_admin(session_factory)
    admin_headers = login_existing(client, "admin@example.com")

    first = client.patch(
        f"/admin/farmer-profiles/{profile_id}/review",
        headers=admin_headers,
        json={"verification_status": "approved"},
    )
    second = client.patch(
        f"/admin/farmer-profiles/{profile_id}/review",
        headers=admin_headers,
        json={"verification_status": "rejected", "rejection_reason": "Changed"},
    )

    assert first.status_code == 200
    assert second.status_code == 409


def approve_profile_for_products(client, admin_headers, profile_id):
    response = client.patch(
        f"/admin/farmer-profiles/{profile_id}/review",
        headers=admin_headers,
        json={"verification_status": "approved"},
    )
    assert response.status_code == 200, response.text


def product_payload(**overrides):
    payload = {
        "name": "Fresh Tomatoes",
        "description": "Freshly harvested tomatoes.",
        "category": "Vegetables",
        "price_per_unit": "1500.00",
        "unit": "kg",
        "quantity_available": "25.00",
    }
    payload.update(overrides)
    return payload


def test_pending_farmer_cannot_publish_product(workflow):
    client, _ = workflow
    headers = register_and_login(
        client, "pending-product-farmer@example.com", "farmer"
    )
    profile_response = create_profile(client, headers)
    assert profile_response.status_code == 201, profile_response.text

    response = client.post(
        "/products",
        headers=headers,
        json=product_payload(),
    )
    assert response.status_code == 403, response.text


def test_buyer_cannot_publish_product(workflow):
    client, _ = workflow
    buyer_headers = register_and_login(
        client, "product-buyer@example.com", "buyer"
    )

    response = client.post(
        "/products",
        headers=buyer_headers,
        json=product_payload(),
    )
    assert response.status_code == 403, response.text


def test_approved_farmer_can_manage_own_product(workflow):
    client, session_factory = workflow
    farmer_headers = register_and_login(
        client, "approved-product-farmer@example.com", "farmer"
    )
    profile_response = create_profile(client, farmer_headers)
    assert profile_response.status_code == 201, profile_response.text
    profile_id = profile_response.json()["id"]

    create_admin(session_factory)
    admin_headers = login_existing(client, "admin@example.com")
    approve_profile_for_products(client, admin_headers, profile_id)

    created = client.post(
        "/products",
        headers=farmer_headers,
        json=product_payload(),
    )
    assert created.status_code == 201, created.text
    product = created.json()
    product_id = product["id"]
    assert product["seller_id"] == profile_response.json()["user_id"]
    assert product["location"] == "Ado-Ekiti, Ekiti State"
    assert product["is_available"] is True

    mine = client.get("/products/mine", headers=farmer_headers)
    assert mine.status_code == 200, mine.text
    assert [item["id"] for item in mine.json()] == [product_id]

    public_list = client.get("/products")
    assert public_list.status_code == 200, public_list.text
    assert product_id in [item["id"] for item in public_list.json()]

    updated = client.patch(
        f"/products/{product_id}",
        headers=farmer_headers,
        json={"name": "Improved Fresh Tomatoes", "quantity_available": "12"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Improved Fresh Tomatoes"

    deleted = client.delete(
        f"/products/{product_id}",
        headers=farmer_headers,
    )
    assert deleted.status_code == 204, deleted.text

    assert client.get(f"/products/{product_id}").status_code == 404
    assert client.get("/products/mine", headers=farmer_headers).json() == []


def test_farmer_cannot_modify_another_farmers_product(workflow):
    client, session_factory = workflow

    first_headers = register_and_login(
        client, "first-product-farmer@example.com", "farmer"
    )
    first_profile = create_profile(client, first_headers)
    assert first_profile.status_code == 201, first_profile.text

    second_headers = register_and_login(
        client, "second-product-farmer@example.com", "farmer"
    )
    second_profile = create_profile(client, second_headers)
    assert second_profile.status_code == 201, second_profile.text

    create_admin(session_factory)
    admin_headers = login_existing(client, "admin@example.com")
    approve_profile_for_products(
        client, admin_headers, first_profile.json()["id"]
    )
    approve_profile_for_products(
        client, admin_headers, second_profile.json()["id"]
    )

    created = client.post(
        "/products",
        headers=first_headers,
        json=product_payload(),
    )
    assert created.status_code == 201, created.text
    product_id = created.json()["id"]

    update_response = client.patch(
        f"/products/{product_id}",
        headers=second_headers,
        json={"name": "Not my product"},
    )
    assert update_response.status_code == 404

    delete_response = client.delete(
        f"/products/{product_id}",
        headers=second_headers,
    )
    assert delete_response.status_code == 404

    # The actual owner still has the listing.
    assert client.get(
        f"/products/{product_id}"
    ).status_code == 200


def test_product_validation_rejects_negative_values(workflow):
    client, session_factory = workflow
    farmer_headers = register_and_login(
        client, "validation-product-farmer@example.com", "farmer"
    )
    profile_response = create_profile(client, farmer_headers)
    assert profile_response.status_code == 201, profile_response.text

    create_admin(session_factory)
    admin_headers = login_existing(client, "admin@example.com")
    approve_profile_for_products(
        client, admin_headers, profile_response.json()["id"]
    )

    for invalid_values in (
        {"price_per_unit": "-1"},
        {"quantity_available": "-2"},
    ):
        response = client.post(
            "/products",
            headers=farmer_headers,
            json=product_payload(**invalid_values),
        )
        assert response.status_code == 422, response.text


def test_public_catalog_hides_unavailable_and_empty_stock(workflow):
    client, session_factory = workflow
    farmer_headers = register_and_login(
        client, "catalog-product-farmer@example.com", "farmer"
    )
    profile_response = create_profile(client, farmer_headers)
    assert profile_response.status_code == 201, profile_response.text

    create_admin(session_factory)
    admin_headers = login_existing(client, "admin@example.com")
    approve_profile_for_products(
        client, admin_headers, profile_response.json()["id"]
    )

    created = client.post(
        "/products",
        headers=farmer_headers,
        json=product_payload(),
    )
    assert created.status_code == 201, created.text
    product_id = created.json()["id"]

    unavailable = client.patch(
        f"/products/{product_id}",
        headers=farmer_headers,
        json={"is_available": False},
    )
    assert unavailable.status_code == 200, unavailable.text
    assert client.get(f"/products/{product_id}").status_code == 404

    restored = client.patch(
        f"/products/{product_id}",
        headers=farmer_headers,
        json={
            "is_available": True,
            "quantity_available": "0",
        },
    )
    assert restored.status_code == 200, restored.text
    assert client.get(f"/products/{product_id}").status_code == 404
