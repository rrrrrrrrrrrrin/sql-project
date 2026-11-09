# conftest.py is a special configuration file used by pytest
# Shared fixtures and test environment

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url


# Get the dedicated test database URL
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

if not TEST_DATABASE_URL:
    raise RuntimeError(
        "TEST_DATABASE_URL environment variable is required."
    )

# Safety check: never run destructive test cleanup on another database
if make_url(TEST_DATABASE_URL).database != "gamestore_test":
    raise RuntimeError(
        "Tests can only run against the gamestore_test database!"
    )

# Configure environment BEFORE importing the application
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

# Provide a test-only JWT secret
os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-secret-key-for-tests"
)

# Import the application only after configuring the environment
from main import app, engine


# Create a shared FastAPI test client
# Allows tests to send requests to FastAPI without running Uvicorn
@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


# Verify that the PostgreSQL connection points to the test database (gamestore_test)
@pytest.fixture(scope="session")
def test_database():
    with engine.connect() as connection:
        database_name = connection.execute(
            text("SELECT current_database()")
        ).scalar_one()

    if database_name != "gamestore_test":
        raise RuntimeError(
            f"Expected gamestore_test, got {database_name}"
        )

    yield

    engine.dispose()


# Clears test records before and after each test
@pytest.fixture(autouse=True)
def clean_test_database(test_database):

    def clear_database():
        with engine.begin() as connection:
            connection.execute(text("""
                TRUNCATE TABLE
                    game_publishers,
                    game_developers,
                    game_reviews,
                    library,
                    dlcs,
                    games,
                    publishers,
                    developers,
                    accounts
                RESTART IDENTITY CASCADE
            """))

    clear_database()

    yield

    clear_database()


# Provide a database connection to tests that need it
# Allows tests to execute SQL and inspect database records
@pytest.fixture
def db_connection(test_database):
    with engine.connect() as connection:
        yield connection
