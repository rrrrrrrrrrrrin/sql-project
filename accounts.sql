CREATE TABLE accounts (
	account_id SERIAL PRIMARY KEY,
	username VARCHAR(32) UNIQUE NOT NULL,
	email VARCHAR(254) UNIQUE NOT NULL,
	phone_number VARCHAR(15) UNIQUE DEFAULT 'No phone number',
	password_hash TEXT,  -- TODO: transform input password to hash
	balance INT
)