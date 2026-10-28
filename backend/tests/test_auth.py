import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.session import get_db
from app.main import app


@pytest.fixture
def client(tmp_path):
    test_database = tmp_path / "test_farmlink.db"

    test_engine = create_engine(
        f"sqlite:///{test_database.as_posix()}",
        connect_args={"check_same_thread": False},
    )

    TestingSessionLocal = sessionmaker(
        bind=test_engine,
        autoflush=False,
        autocommit=False,
    )

    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()


def test_register_buyer(client):
    response = client.post(
        "/auth/register",
        json={
            "full_name": "Test Buyer",
            "email": "buyer@example.com",
            "password": "SecurePass123!",
            "role": "buyer",
        },
    )

    assert response.status_code == 201

    data = response.json()
    assert data["full_name"] == "Test Buyer"
    assert data["email"] == "buyer@example.com"
    assert data["role"] == "buyer"
    assert "password_hash" not in data


def test_register_farmer(client):
    response = client.post(
        "/auth/register",
        json={
            "full_name": "Test Farmer",
            "email": "farmer@example.com",
            "password": "SecurePass123!",
            "role": "farmer",
        },
    )

    assert response.status_code == 201
    assert response.json()["role"] == "farmer"


def test_registration_rejects_admin_role(client):
    response = client.post(
        "/auth/register",
        json={
            "full_name": "Test Admin",
            "email": "admin@example.com",
            "password": "SecurePass123!",
            "role": "admin",
        },
    )

    assert response.status_code == 422


def test_registration_rejects_duplicate_email(client):
    payload = {
        "full_name": "Test Buyer",
        "email": "duplicate@example.com",
        "password": "SecurePass123!",
        "role": "buyer",
    }

    first_response = client.post("/auth/register", json=payload)
    second_response = client.post("/auth/register", json=payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 409


def test_login_returns_access_token(client):
    client.post(
        "/auth/register",
        json={
            "full_name": "Login Buyer",
            "email": "login@example.com",
            "password": "SecurePass123!",
            "role": "buyer",
        },
    )

    response = client.post(
        "/auth/login",
        json={
            "email": "login@example.com",
            "password": "SecurePass123!",
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["user"]["email"] == "login@example.com"
    assert "password_hash" not in data["user"]


def test_login_rejects_wrong_password(client):
    client.post(
        "/auth/register",
        json={
            "full_name": "Login Buyer",
            "email": "wrong-password@example.com",
            "password": "SecurePass123!",
            "role": "buyer",
        },
    )

    response = client.post(
        "/auth/login",
        json={
            "email": "wrong-password@example.com",
            "password": "WrongPassword123!",
        },
    )

    assert response.status_code == 401


def test_current_user_requires_token(client):
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_current_user_accepts_valid_token(client):
    client.post(
        "/auth/register",
        json={
            "full_name": "Current User",
            "email": "current@example.com",
            "password": "SecurePass123!",
            "role": "buyer",
        },
    )

    login_response = client.post(
        "/auth/login",
        json={
            "email": "current@example.com",
            "password": "SecurePass123!",
        },
    )

    token = login_response.json()["access_token"]

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "current@example.com"
    assert response.json()["role"] == "buyer"
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.session import get_db
from app.main import app


@pytest.fixture
def client(tmp_path):
    test_database = tmp_path / "test_farmlink.db"

    test_engine = create_engine(
        f"sqlite:///{test_database.as_posix()}",
        connect_args={"check_same_thread": False},
    )

    TestingSessionLocal = sessionmaker(
        bind=test_engine,
        autoflush=False,
        autocommit=False,
    )

    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()


def test_register_buyer(client):
    response = client.post(
        "/auth/register",
        json={
            "full_name": "Test Buyer",
            "email": "buyer@example.com",
            "password": "SecurePass123!",
            "role": "buyer",
        },
    )

    assert response.status_code == 201

    data = response.json()
    assert data["full_name"] == "Test Buyer"
    assert data["email"] == "buyer@example.com"
    assert data["role"] == "buyer"
    assert "password_hash" not in data


def test_register_farmer(client):
    response = client.post(
        "/auth/register",
        json={
            "full_name": "Test Farmer",
            "email": "farmer@example.com",
            "password": "SecurePass123!",
            "role": "farmer",
        },
    )

    assert response.status_code == 201
    assert response.json()["role"] == "farmer"


def test_registration_rejects_admin_role(client):
    response = client.post(
        "/auth/register",
        json={
            "full_name": "Test Admin",
            "email": "admin@example.com",
            "password": "SecurePass123!",
            "role": "admin",
        },
    )

    assert response.status_code == 422


def test_registration_rejects_duplicate_email(client):
    payload = {
        "full_name": "Test Buyer",
        "email": "duplicate@example.com",
        "password": "SecurePass123!",
        "role": "buyer",
    }

    first_response = client.post("/auth/register", json=payload)
    second_response = client.post("/auth/register", json=payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 409


def test_login_returns_access_token(client):
    client.post(
        "/auth/register",
        json={
            "full_name": "Login Buyer",
            "email": "login@example.com",
            "password": "SecurePass123!",
            "role": "buyer",
        },
    )

    response = client.post(
        "/auth/login",
        json={
            "email": "login@example.com",
            "password": "SecurePass123!",
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["user"]["email"] == "login@example.com"
    assert "password_hash" not in data["user"]


def test_login_rejects_wrong_password(client):
    client.post(
        "/auth/register",
        json={
            "full_name": "Login Buyer",
            "email": "wrong-password@example.com",
            "password": "SecurePass123!",
            "role": "buyer",
        },
    )

    response = client.post(
        "/auth/login",
        json={
            "email": "wrong-password@example.com",
            "password": "WrongPassword123!",
        },
    )

    assert response.status_code == 401


def test_current_user_requires_token(client):
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_current_user_accepts_valid_token(client):
    client.post(
        "/auth/register",
        json={
            "full_name": "Current User",
            "email": "current@example.com",
            "password": "SecurePass123!",
            "role": "buyer",
        },
    )

    login_response = client.post(
        "/auth/login",
        json={
            "email": "current@example.com",
            "password": "SecurePass123!",
        },
    )

    token = login_response.json()["access_token"]

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "current@example.com"
    assert response.json()["role"] == "buyer"
