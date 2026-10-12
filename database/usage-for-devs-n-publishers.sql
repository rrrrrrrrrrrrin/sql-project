-- 1. Выпуск новой игры или DLC
INSERT INTO games (title, release_date, genre, price)
VALUES (:title, CURRENT_DATE, :genre, :price)

INSERT INTO dlcs (title, release_date, price)
VALUES (:title, CURRENT_DATE, :price)

-- 2. Удаление игры из магазина (+ удаление dlcs, привязанных по games.game_id (ON DELETE CASCADE))
DELETE FROM games WHERE title = :title
