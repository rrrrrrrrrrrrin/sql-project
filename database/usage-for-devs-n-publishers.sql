-- 1. Выпуск новой игры или DLC
INSERT INTO games (title, release_date, genre, dev_id, publish_id, price)
VALUES (:title, CURRENT_DATE, :genre, :dev_id, :publish_id, :price)

INSERT INFO dlcs (title, release_date, price)
VALUES (:title, CURRENT_DATE, :price)

-- 2. Удаление игры из магазина (+ удаление dlcs, привязанных по games.game_id (ON DELETE CASCADE))
DELETE FROM games WHERE title = :title
