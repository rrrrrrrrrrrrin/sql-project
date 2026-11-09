from fastapi.testclient import TestClient

from main import app


# Create a test client for the FastAPI application
client = TestClient(app)


def test_health_endpoint():
    """Check that the API health endpoint works."""

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_current_account_requires_authentication():
    """An unauthenticated user should not access account information."""

    response = client.get("/api/me")

    assert response.status_code == 401


def test_publishing_game_requires_authentication():
    """A user without a JWT token cannot publish a game."""

    game_data = {
        "title": "Test Game",
        "release_date": "2026-01-15",
        "genre": "Adventure",
        "price": 19.99
    }

    response = client.post("/api/games", json=game_data)

    assert response.status_code == 401


def test_registration_rejects_publisher_role():
    """A user cannot assign themself the publisher role."""

    user_data = {
        "username": "test_user",
        "email": "test@example.com",
        "password": "test_password",
        "role": "publisher"
    }

    response = client.post("/api/register", json=user_data)

    assert response.status_code == 403
