-- Test data is located correctly
/* WITH json_data AS (
    SELECT *
    FROM jsonb_array_elements(
        pg_read_file('/data/games.json')::jsonb
    ) AS data
)

SELECT * FROM json_data;*/

-- Read json data from file and insert into games table
WITH json_data AS (
     SELECT jsonb_array_elements(
        pg_read_file('/data/games.json')::jsonb
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

