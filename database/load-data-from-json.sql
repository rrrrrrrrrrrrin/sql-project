-- Read json data from games.json and insert into games table
WITH json_data AS (
     SELECT jsonb_array_elements(
        pg_read_file('/db-data/data/db-data/games.json')::jsonb
    ) AS data
)
INSERT INTO games (title, genre, release_date, price)
SELECT 
    data->>'title' AS title,
    data->>'genre' AS genre,
    (data->>'release_date')::date AS release_date,
    (data->>'price')::numeric AS price
FROM json_data
ON CONFLICT (title) DO NOTHING;

-- Find conflicts and display which field is already taken in accounts (username and/or email)
WITH json_data AS (
     SELECT jsonb_array_elements(pg_read_file('/db-data/data/db-data/accounts.json')::jsonb) AS data
),
parsed_data AS (
    SELECT data->>'username' AS username, data->>'email' AS email FROM json_data
)
SELECT 
    p.username, 
    p.email,
    CASE 
        WHEN a.username IS NOT NULL AND a.email IS NOT NULL THEN 'Both username and email are already taken'
        WHEN a.username IS NOT NULL THEN 'Username is already taken'
        ELSE 'Email is already taken'
    END AS error_message
FROM parsed_data p
JOIN accounts a ON a.username = p.username OR a.email = p.email;

-- Read json data from accounts.json and insert into accounts table
CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH json_data AS (
     SELECT jsonb_array_elements(
        pg_read_file('/db-data/data/db-data/accounts.json')::jsonb
    ) AS data
),
parsed_data AS (
    SELECT 
        data->>'username' AS username,
        data->>'email' AS email,
        -- Encrypts the raw JSON password using Blowfish (bf) salting
        crypt(data->>'password_hash', gen_salt('bf')) AS password_hash
    FROM json_data
)
INSERT INTO accounts (username, email, password_hash)
SELECT p.username, p.email, p.password_hash
FROM parsed_data p
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a 
    WHERE a.username = p.username OR a.email = p.email
);
