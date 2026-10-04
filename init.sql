CREATE TABLE accounts (
	account_id SERIAL PRIMARY KEY,
	username VARCHAR(32) UNIQUE NOT NULL,
	email VARCHAR(254) UNIQUE NOT NULL,
	phone_number VARCHAR(15) UNIQUE DEFAULT 'No phone number',
	password_hash TEXT,  -- TODO: transform input password to hash
	balance INT
)

CREATE TABLE games (
    game_id SERIAL PRIMARY KEY,
    title VARCHAR(100) UNIQUE NOT NULL,
    release_date DATE,
    genre VARCHAR(50),
    dev_id INT REFERENCES developers(dev_id) ON DELETE CASCADE,
    publish_id REFERENCES publishers(publish_id) ON DELETE CASCADE,
    price DECIMAL(10, 2)
);

CREATE TABLE dlcs (
    dlc_id SERIAL PRIMARY KEY,
    game_id INT REFERENCES games(game_id) ON DELETE CASCADE,
    title VARCHAR(100) UNIQUE NOT NULL,
    release_date DATE,
    price DECIMAL(10, 2)
);

CREATE TABLE library (
    library_id SERIAL PRIMARY KEY,
    account_id INT REFERENCES accounts(account_id) ON DELETE CASCADE,
    game_id INT REFERENCES games(game_id) ON DELETE CASCADE,
    dlc_id INT REFERENCES dlcs(dlc_id) ON DELETE CASCADE,
    dev_id INT REFERENCES developers(dev_id) ON DELETE CASCADE,
    publish_id REFERENCES publishers(publish_id) ON DELETE CASCADE,
    purchase_date DATE DEFAULT CURRENT_DATE,
    playtime_hours INT DEFAULT 0,

    -- Один аккаунт может купить конкретную игру только один раз
    CREATE UNIQUE INDEX unique_account_game
    ON library(account_id, game_id)
    WHERE dlc_id IS NULL;

    -- Один аккаунт может купить конкретное dlc только один раз
    CREATE UNIQUE INDEX unique_account_dlc
    ON library(account_id, dlc_id)
    WHERE dlc_id IS NOT NULL;
);

CREATE TABLE game_reviews (
    review_id SERIAL PRIMARY KEY,
    game_id INT REFERENCES games(game_id) ON DELETE CASCADE,
    account_id INT REFERENCES accounts(account_id) ON DELETE CASCADE,
    rating INT CHECK (rating >= 1 AND rating <= 10),
    review_text TEXT,
    review_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE developers (
    dev_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    founded_date DATE
);

CREATE TABLE publishers (
    publish_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    founded_date DATE
);