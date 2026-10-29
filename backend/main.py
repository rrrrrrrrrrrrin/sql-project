# Impprt tools
import os  # reads environment variables, such as database URL
from decimal import Decimal

from dotenv import load_dotenv  # reads settings from .env file
from fastapi import FastAPI, HTTPException  # FastAPI creates web API, HTTPException returns HTTP errors
from sqlalchemy import create_engine, text  # creates a connection to the database and executes SQL queries
from sqlalchemy.exc import SQLAlchemyError  # handles database errors

# Load database connection URL (DATABASE_URL) from .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing. Check backend/.env")

# Create the database engine
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# Create FastAPI application
app = FastAPI(title="GameStore API", version="0.1.0")


# 3 API endpoints: home, health check, and get games
# Open the root URL and returns a message confirming that the backend is running: localhost:8080
@app.get("/")
def home():
    return {"message": "GameStore Python backend is running!"}


# Return a simple status message. It does not check whether PostgreSQL is reachable:
# localhost:8080/api/health
@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# Return a list of all games in the database, including game_id, title, release_date, genre, and price.
# localhost:8080/api/games
@app.get("/api/games")
def get_games():
    try:
        # Connect to PostgreSQL (closes the connection when with block finishes)
        with engine.connect() as connection:
            result = connection.execute(
                # Run the SQL query to return cols from games table, sorted by game_id
                text("""
                    SELECT game_id, title, release_date, genre, price
                    FROM games
                    ORDER BY game_id
                """)
            )

            games = []
            # Convert each database row into a Python dictionary and append it to the games list, ready for FastAPI to return as JSON
            for row in result.mappings():
                game = dict(row)
                game["release_date"] = (
                    game["release_date"].isoformat()
                    if game["release_date"] is not None
                    else None
                )
                if isinstance(game["price"], Decimal):
                    game["price"] = float(game["price"])
                games.append(game)

            return games  # the API returns a JSON array

    # Handle database errors
    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Could not retrieve games from the database. Check the database connection and games table.",
        )
