# PostgreSQL integration tests

from sqlalchemy import text

from main import engine


# Registration test 
def register_test_user(client, username="db_test_user"):
    """Register a test account through the API."""

    user_data = {
        "username": username,
        "email": f"{username}@example.com",
        "password": "test_password123"
    }

    response = client.post("/api/register", json=user_data)

    assert response.status_code == 201

    return user_data


# Log in test user test
def login_test_user(client, username, password="test_password123"):
    """Log in through the API and return the response."""

    return client.post(
        "/api/login",
        data={
            "username": username,
            "password": password
        }
    )


# Verify that the API correctly saves accounts to the PostgreSQL database
def test_registration_saves_account_to_database(client, db_connection):
    """Verify that registration creates an account in PostgreSQL."""

    user_data = register_test_user(client)

    result = db_connection.execute(
        text("""
            SELECT account_id, username, email, role
            FROM accounts
            WHERE username = :username
        """),
        {"username": user_data["username"]}
    )

    account = result.mappings().one_or_none()

    assert account is not None
    assert account["username"] == user_data["username"]
    assert account["email"] == user_data["email"]
    assert account["role"] == "user"


# Password hashing test
def test_password_is_stored_as_hash(client, db_connection):
    """Verify that PostgreSQL stores a password hash, not plain text."""

    user_data = register_test_user(client)

    result = db_connection.execute(
        text("""
            SELECT
                password_hash,
                password_hash = crypt(:password, password_hash) AS valid_hash
            FROM accounts
            WHERE username = :username
        """),
        {
            "username": user_data["username"],
            "password": user_data["password"]
        }
    )

    account = result.mappings().one()

    assert account["password_hash"] != user_data["password"]
    assert account["valid_hash"] is True


# Verify that a registered user can log in and receive a JWT token
def test_login_with_correct_password(client):
    """Verify that a registered user can log in."""

    user_data = register_test_user(client)

    response = login_test_user(
        client,
        user_data["username"],
        user_data["password"]
    )

    assert response.status_code == 200

    login_data = response.json()

    assert login_data["access_token"]
    assert login_data["token_type"].lower() == "bearer"

    # Verify that the JWT can authenticate the user
    me_response = client.get(
        "/api/me",
        headers={
            "Authorization": f"Bearer {login_data['access_token']}"
        }
    )

    assert me_response.status_code == 200
    assert me_response.json()["username"] == user_data["username"]


def test_login_with_incorrect_password(client):
    """Verify that incorrect credentials are rejected."""

    user_data = register_test_user(client)

    response = login_test_user(
        client,
        user_data["username"],
        "wrong_password"
    )

    assert response.status_code == 401


# Verify that a publisher can publish a game and that the game is saved in PostgreSQL
def test_publisher_can_publish_game(client, db_connection):
    """Verify that a publisher can publish a game."""

    username = "test_publisher"

    register_test_user(client, username)

    # Promote the test account directly in the test database.
    # Normal users cannot assign themselves the publisher role.
    with engine.begin() as connection:
        connection.execute(
            text("""
                UPDATE accounts
                SET role = 'publisher'
                WHERE username = :username
            """),
            {"username": username}
        )

    # Log in after changing the role
    login_response = login_test_user(client, username)

    assert login_response.status_code == 200

    token = login_response.json()["access_token"]

    game_data = {
        "title": "Integration Test Game",
        "release_date": "2026-01-15",
        "genre": "Adventure",
        "price": 19.99
    }

    response = client.post(
        "/api/games",
        json=game_data,
        headers={
            "Authorization": f"Bearer {token}"
        }
    )

    assert response.status_code == 201

    # Check that the game was actually saved in PostgreSQL
    result = db_connection.execute(
        text("""
            SELECT game_id, title, genre, price
            FROM games
            WHERE title = :title
        """),
        {"title": game_data["title"]}
    )

    game = result.mappings().one_or_none()

    assert game is not None
    assert game["title"] == game_data["title"]
    assert game["genre"] == game_data["genre"]
    assert float(game["price"]) == 19.99


def test_regular_user_cannot_publish_game(client):
    """Verify that an ordinary user cannot publish a game."""

    username = "test_regular_user"

    register_test_user(client, username)

    login_response = login_test_user(client, username)

    assert login_response.status_code == 200

    token = login_response.json()["access_token"]

    game_data = {
        "title": "Unauthorized Test Game",
        "release_date": "2026-01-15",
        "genre": "Action",
        "price": 29.99
    }

    response = client.post(
        "/api/games",
        json=game_data,
        headers={
            "Authorization": f"Bearer {token}"
        }
    )

    assert response.status_code == 403
