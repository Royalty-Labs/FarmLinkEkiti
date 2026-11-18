from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["service"] == "fieldbasket-api"


def test_cors_origins_are_parsed_from_settings():
    from app.core.config import Settings

    configured = Settings(
        jwt_secret_key="x" * 32,
        cors_origins=" https://fieldbasket.ng/ , https://www.fieldbasket.ng,, ",
    )

    assert configured.cors_origin_list == [
        "https://fieldbasket.ng",
        "https://www.fieldbasket.ng",
    ]
