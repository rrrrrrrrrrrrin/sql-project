# Import tools
import os  # reads environment variables, such as database URL
from decimal import Decimal

from dotenv import load_dotenv  # reads settings from .env file
from datetime import date, datetime, timedelta, timezone  # timedelta represents a time duration
from pydantic import BaseModel  # Creates Pydantic models for validating incoming data from the frontend

# FastAPI creates web API, HTTPException returns HTTP errors,
# Body reads JSON data from the request body (an HTTP request),
# Depends lets FastAPI check the token before allowing access to certain endpoints,
# Form reads form data from the request body (an HTTP request))
from fastapi import FastAPI, HTTPException, Body, Depends, Form

from sqlalchemy import create_engine, text  # creates a connection to the database and executes SQL queries
from sqlalchemy.exc import SQLAlchemyError  # handles database errors

import jwt  # Creates and verifies JSON Web Tokens (for authentication)
from fastapi.security import OAuth2PasswordBearer  # Extracts a Bearer token from the Authorization header


# Load database connection URL (DATABASE_URL) from .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")  # Database connection URL for PostgreSQL, read from backend/.env

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing. Check backend/.env")

# Create the database engine
engine = create_engine(DATABASE_URL, pool_pre_ping=True)


# Authentication configuration
# This is a secret key used to sign and verify JWT tokens
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is missing from backend/.env")

JWT_ALGORITHM = "HS256"  # specifies the algorithm used to sign the token
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # means a login token is valid for 60 minutes

# This tells FastAPI that our API uses Bearer tokens for authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

# Create FastAPI application
app = FastAPI(title="GameStore API", version="0.1.0")

# Models define what information our API expects
# They also validate incoming data

# This describes the data the frontend must send when publishing a game
class GameCreate(BaseModel):
    title: str
    release_date: date
    genre: str
    price: Decimal

# Registration model
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"

# Login model
class LoginRequest(BaseModel):
    username: str
    password: str


# Authentication functions
# These functions handle token creation, verification and permissions

# This function creates a JWT token for a logged-in account
# It receives the account_id and role of the account, and returns a signed JWT token
def create_access_token(account_id: int, role: str):
    # This calculates when the token expires (after 60 mins)
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    # The payload of the token contains subject, role, and expiration time
    payload = {
        "sub": str(account_id),  # subject: identifies the account
        "role": role,
        "exp": expire,
    }

    # This creates and signs the token
    # The result is a long string that the frontend receives after successful login
    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )

# This function checks whether a request comes from an authenticated account
# Depends on the oauth2_scheme to extract the token from the Authorization header in frontend requests
# This function is useful because other endpoints can now access the authenticated user's information
# without repeating all the token verification code
def get_current_account(token: str = Depends(oauth2_scheme)):
    try:
        # This verifies the JWT signature and checks its expiration
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        account_id = int(payload["sub"])  # extract the account ID from the token

    # Error handling:
    #  invalid or expired token,
    #  missing account ID in the token,
    #  invalid account ID (not an integer)
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired login token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Checking the database
        # After verifying the token, we retrieve the account 
        # (we don't retrive the password hash, for security reasons)
        with engine.connect() as connection:
            account = connection.execute(
                text("""
                    SELECT account_id, username, email, role
                    FROM accounts
                    WHERE account_id = :account_id
                """),
                {"account_id": account_id},
            ).mappings().first()

        if account is None:
            raise HTTPException(
                status_code=401,
                detail="Account not found.",
            )

        return dict(account)  # Return the account information as a normal Python dictionary

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Could not verify account.",
        )


# This function checks whether the authenticated account is a publisher
# FastAPI automatically runs get_current_account() (verifies the token and returns account information)
def require_publisher(account: dict = Depends(get_current_account)):
    if account["role"] != "publisher":
        raise HTTPException(
            status_code=403,
            detail="Only publishers can perform this action.",
        )

    return account


# API endpoints: home, health check, get games, api/register, api/login, api/games (publish game)
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


# This is where a new user creates an account
# The function receives the registration information in the request body
#   HTTP method: POST (sends data to the server: frontend -> backend)
#   URL: /api/register
@app.post("/api/register", status_code=201)
def register(data: RegisterRequest):
    # Checking the role: new accounts can only register as users
    if data.role != "user":
        raise HTTPException(
            status_code=403,
            detail="New accounts can only register as users.",
        )

    try:
        # Inserting the account into the database
        # If everything succeeds, SQLAlchemy commits the transaction automatically
        with engine.begin() as connection:
            result = connection.execute(
                text("""
                    INSERT INTO accounts (
                        username,
                        email,
                        password_hash,
                        role
                    )
                    VALUES (
                        :username,
                        :email,
                        crypt(:password, gen_salt('bf')),
                        'user'
                    )
                    RETURNING account_id, username, email, role
                """),
                {
                    "username": data.username,
                    "email": data.email,
                    "password": data.password,
                },
            ).mappings().one()

            return dict(result)  # convert the result into a Python dictionary and send it to the frontend

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=400,
            detail="Could not register. Username or email already exists.",
        ) from exc


# This endpoint allows an existing account to log in
@app.post("/api/login")
# The endpoint receives username and password
# The Form(...) means that FastAPI expects form-encoded data rather than JSON
# We use this because Swagger's OAuth2 password flow sends form data
def login(
    username: str = Form(...),
    password: str = Form(...),
):
    try:
        # Checking the username and password hash in the database
        with engine.connect() as connection:
            account = connection.execute(
                text("""
                    SELECT account_id, username, email, role
                    FROM accounts
                    WHERE username = :username
                    AND password_hash = crypt(:password, password_hash)
                """),
                {
                    "username": username,
                    "password": password,
                },
            ).mappings().first()  # retrieves the first matching account

        if account is None:
            raise HTTPException(
                status_code=401,
                detail="Incorrect username or password.",
            )

        # If the credentials are correct,
        # creates a JWT containing the account ID, role and expiration time for the logged-in account
        token = create_access_token(
            account["account_id"],
            account["role"],
        )

        # The backend returns a JSON object
        # The frontend receives the token and account information (in JSON)
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": account["username"],
            "role": account["role"],
        }

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Login service is unavailable.",
        )


# Endpoint: publish a new game
# Only accounts with the role of "publisher" can publish games
# The account_id is sent in the request body along with the game data
@app.post("/api/games", status_code=201)
def publish_game(
    game: GameCreate,
    account: dict = Depends(require_publisher),
):
    try:
        with engine.begin() as connection:
            # Insert the new game
            result = connection.execute(
                text("""
                    INSERT INTO games (title, release_date, genre, price)
                    VALUES (:title, :release_date, :genre, :price)
                    RETURNING game_id, title, release_date, genre, price
                """),
                {
                    "title": game.title,
                    "release_date": game.release_date,
                    "genre": game.genre,
                    "price": game.price,
                },
            ).mappings().one()

            new_game = dict(result)
            new_game["release_date"] = new_game["release_date"].isoformat()
            new_game["price"] = float(new_game["price"])

            return new_game

    except SQLAlchemyError as exc:
        # Duplicate titles and other database constraint errors
        # are reported as a client error
        raise HTTPException(
            status_code=400,
            detail="Could not publish game. Check the title and submitted data.",
        ) from exc

