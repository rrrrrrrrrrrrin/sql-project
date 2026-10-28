
import os
from decimal import Decimal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.engine import URL

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing. Check backend/.env")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

app = FastAPI(title="GameStore API", version="0.1.0")


@app.get("/")
def home():
    return {"message": "GameStore Python backend is running!"}


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/games")
def get_games():
    try:
        with engine.connect() as connection:
            result = connection.execute(
                text("""
                    SELECT game_id, title, release_date, genre, price
                    FROM games
                    ORDER BY game_id
                """)
            )

            games = []
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

            return games

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Could not retrieve games from the database. Check the database connection and games table.",
        )
