# GameStore API Documentation

**API name:** GameStore API  
**API version:** 0.1.0  
**Backend technology:** Python, FastAPI, SQLAlchemy, PostgreSQL  
**Development base URL:** `http://localhost:8080`  
**Interactive documentation:** `http://localhost:8080/docs`  
**OpenAPI schema:** `http://localhost:8080/openapi.json`

## 1. Overview

The GameStore API provides HTTP endpoints used by the React frontend. The frontend communicates with FastAPI using HTTP requests and JSON responses. The backend communicates with PostgreSQL through SQLAlchemy.

The API supports:

- checking whether the backend is running;
- retrieving the public game catalog;
- registering an account;
- logging in and receiving a JWT access token;
- retrieving the currently authenticated account;
- publishing a game, restricted to accounts whose database role is `publisher`.

## 2. Authentication and authorization

The API uses **Bearer JWT authentication** for protected endpoints.

After a successful login, the API returns an access token. A client must send this token in the HTTP `Authorization` header when calling a protected endpoint:

```http
Authorization: Bearer <access_token>
```

The token is signed using the `HS256` algorithm and expires after 60 minutes. The signing key is read from the backend environment variable `JWT_SECRET_KEY` and must remain secret.

The backend verifies the token and retrieves the account from the `accounts` table. For game publishing, the backend checks the account's current `role` in PostgreSQL and permits the operation only when the role is `publisher`.

### Endpoint access summary

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| GET | `/` | Not required | Backend welcome/status message |
| GET | `/api/health` | Not required | Basic API health response |
| GET | `/api/games` | Not required | Retrieve the game catalog |
| POST | `/api/register` | Not required | Register a new user account |
| POST | `/api/login` | Not required | Verify credentials and issue a JWT |
| GET | `/api/me` | Bearer JWT required | Retrieve the current account |
| POST | `/api/games` | Publisher Bearer JWT required | Publish a new game |

## 3. Data formats and models

### 3.1 GameCreate

Used as the JSON request body for `POST /api/games`.

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | Yes | Game title |
| `release_date` | date string (`YYYY-MM-DD`) | Yes | Game release date |
| `genre` | string | Yes | Game genre |
| `price` | decimal number | Yes | Game price; the database currently has a non-negative price constraint |

Example:

```json
{
  "title": "Example Adventure",
  "release_date": "2026-11-15",
  "genre": "Adventure",
  "price": 19.99
}
```

### 3.2 RegisterRequest

Used as the JSON request body for `POST /api/register`.

| Field | Type | Required | Description |
|---|---|---|---|
| `username` | string | Yes | New account username |
| `email` | string | Yes | New account email address |
| `password` | string | Yes | Plain-text password sent over the HTTP request; the backend stores a hash, not the original password |
| `role` | string | No | Defaults to `user`. The endpoint rejects a supplied value other than `user` with HTTP 403 |

Example (recommended; omit `role`):

```json
{
  "username": "new_player",
  "email": "player@example.com",
  "password": "example-password"
}
```

The password is hashed in PostgreSQL using `pgcrypto` (`crypt` with a generated Blowfish/bf salt). The API does not return the password hash.

### 3.3 Login form fields

`POST /api/login` expects `application/x-www-form-urlencoded` form data, not a JSON request body.

| Field | Type | Required | Description |
|---|---|---|---|
| `username` | string | Yes | Existing account username |
| `password` | string | Yes | Original password entered by the user (not the stored hash) |

## 4. Endpoints

### 4.1 GET `/`

**Purpose:** Returns a message indicating that the FastAPI backend is running.

**Authentication:** Not required.

**Request body:** None.

**Successful response — `200 OK`:**

```json
{
  "message": "GameStore Python backend is running!"
}
```

### 4.2 GET `/api/health`

**Purpose:** Returns a basic status response from the API.

**Authentication:** Not required.

**Request body:** None.

**Successful response — `200 OK`:**

```json
{
  "status": "ok"
}
```

**Important:** In the current implementation, this endpoint does not check whether PostgreSQL is reachable. It only confirms that the API endpoint responds.

### 4.3 GET `/api/games`

**Purpose:** Retrieves all games from the `games` table, ordered by `game_id` in ascending order.

**Authentication:** Not required.

**Request body:** None.

**Successful response — `200 OK`:** A JSON array of game objects. An empty database result is returned as an empty array (`[]`).

Example:

```json
[
  {
    "game_id": 1,
    "title": "Resident Evil",
    "release_date": "1996-03-22",
    "genre": "Horror",
    "price": 4.99
  },
  {
    "game_id": 2,
    "title": "Resident Evil 2",
    "release_date": "1998-01-21",
    "genre": "Horror",
    "price": 4.99
  }
]
```

**Possible error responses:**

- `503 Service Unavailable` — the backend could not retrieve games from the database.

### 4.4 POST `/api/register`

**Purpose:** Creates a new account. New registrations receive the `user` role.

**Authentication:** Not required.

**Content-Type:** `application/json`.

**Request body:** `RegisterRequest`.

Example:

```json
{
  "username": "new_player",
  "email": "player@example.com",
  "password": "example-password"
}
```

**Successful response — `201 Created`:**

```json
{
  "account_id": 25,
  "username": "new_player",
  "email": "player@example.com",
  "role": "user"
}
```

The response does not contain `password_hash`.

**Possible error responses:**

- `400 Bad Request` — insertion failed, for example because the username or email conflicts with an existing unique value.
- `403 Forbidden` — the request explicitly supplied a role other than `user`.
- `422 Unprocessable Entity` — the request body does not match the Pydantic model (for example, a required field is missing or has an incompatible type).

### 4.5 POST `/api/login`

**Purpose:** Verifies the account credentials and returns a JWT access token.

**Authentication:** Not required.

**Content-Type:** `application/x-www-form-urlencoded`.

**Request form fields:**

```text
username=new_player&password=example-password
```

The password must be the original password chosen by the user. The client must not submit the hash stored in PostgreSQL. The backend verifies the submitted password against the stored `password_hash` using PostgreSQL `crypt()`.

**Successful response — `200 OK`:**

```json
{
  "access_token": "<signed-jwt-token>",
  "token_type": "bearer",
  "username": "new_player",
  "role": "user"
}
```

The `access_token` must be included in the `Authorization` header for protected endpoints.

**Possible error responses:**

- `401 Unauthorized` — username or password is incorrect.
- `422 Unprocessable Entity` — required form fields are missing or invalid.
- `503 Service Unavailable` — the login service could not query the database.

### 4.6 GET `/api/me`

**Purpose:** Returns information about the currently authenticated account. The frontend uses this endpoint to restore a login session after a page refresh.

**Authentication:** Bearer JWT required.

**Request headers:**

```http
Authorization: Bearer <access_token>
```

**Request body:** None.

**Successful response — `200 OK`:**

```json
{
  "account_id": 25,
  "username": "new_player",
  "email": "player@example.com",
  "role": "user"
}
```

**Possible error responses:**

- `401 Unauthorized` — token is missing, invalid, expired, or references an account that no longer exists.
- `503 Service Unavailable` — the backend could not verify the account because of a database error.

### 4.7 POST `/api/games`

**Purpose:** Creates a new game in the `games` table.

**Authentication:** A valid Bearer JWT belonging to an account whose current database role is `publisher` is required.

**Content-Type:** `application/json`.

**Request headers:**

```http
Authorization: Bearer <publisher-access-token>
Content-Type: application/json
```

**Request body:** `GameCreate`.

Example:

```json
{
  "title": "Example Adventure",
  "release_date": "2026-11-15",
  "genre": "Adventure",
  "price": 19.99
}
```

The client does not send `account_id`. The backend identifies the account from the verified JWT and checks its role in PostgreSQL.

**Successful response — `201 Created`:**

```json
{
  "game_id": 15,
  "title": "Example Adventure",
  "release_date": "2026-11-15",
  "genre": "Adventure",
  "price": 19.99
}
```

**Possible error responses:**

- `400 Bad Request` — the database rejected the insertion, for example because the game title already exists or a database constraint was violated.
- `401 Unauthorized` — no valid login token was supplied.
- `403 Forbidden` — the authenticated account does not have the `publisher` role.
- `422 Unprocessable Entity` — the JSON body does not match `GameCreate`.

## 5. HTTP status code summary

| Status | Meaning in this API |
|---|---|
| `200 OK` | Request completed successfully |
| `201 Created` | Account or game was created successfully |
| `400 Bad Request` | Database insertion failed or a conflict occurred |
| `401 Unauthorized` | Authentication is missing or invalid, or login credentials are incorrect |
| `403 Forbidden` | The account is not permitted to perform the operation |
| `422 Unprocessable Entity` | Request data failed validation |
| `503 Service Unavailable` | A database-related operation could not be completed |

## 6. Interactive API documentation

FastAPI generates interactive API documentation from the application routes and Pydantic models:

- Swagger UI: `http://localhost:8080/docs`
- ReDoc: `http://localhost:8080/redoc`
- OpenAPI JSON: `http://localhost:8080/openapi.json`

Swagger UI can be used to inspect endpoints and send test requests. For protected endpoints, use the **Authorize** control to authenticate with a publisher account before testing `POST /api/games`.

## 7. Current implementation notes and limitations

This document describes the current implementation represented by `backend/main.py`.

1. `GET /api/health` checks that the API responds; it does not perform a database health check.
2. Registration currently relies on the database's unique constraints for duplicate usernames and emails. More explicit input validation (such as username length, password length, and email validation) can be added to the Pydantic model.
3. The API currently returns database insertion errors from registration and game publishing as HTTP 400. A future improvement would distinguish constraint conflicts from database availability errors.
4. Logout in the current frontend clears the token from browser `sessionStorage`. There is no server-side token revocation endpoint; a copied token remains valid until its expiration unless other checks reject it.
5. The API currently exposes game listing and publishing. Other database features, such as library management, DLC management, reviews, developers, and publishers, are not exposed through endpoints in the current `main.py` implementation.

---

**Document maintenance:** Update this document whenever an endpoint, request model, authentication rule, response, or status code changes in `backend/main.py`.
