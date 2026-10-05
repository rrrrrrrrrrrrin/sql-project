-- TODO: проверять целостность вводимых данных

-- 1. Создание аккаунта: добавление нового пользователя по username и email (обязательные уникальные параметры)
INSERT INTO accounts (username, email, password_hash)
VALUES (:username, :email, crypt(:user_password, gen_salt('bf')));
-- TODO: Сделать вход в аккаунт (проверка username и password)?
-- TODO: Изменение username или password

-- 2. Просмотр магазина: фильтрация игр по genre, release_date, developer
SELECT title, genre FROM games WHERE genre= :genre;
SELECT title, release_date FROM games WHERE release_date= :release_date  -- YYYY-MM-DD
SELECT title, dev_id FROM game_developers WHERE dev_id ILIKE :dev_id

-- 3. Покупка игры (добавление игры в library (по account_id, game_id); 
-- изменение balance (в таблице accounts)); невозможность купить игру дважды)
WITH 
-- Проверка есть ли эта игра уже в библиотеке
check_library AS (
    SELECT 1 FROM library WHERE account_id = :account_id AND game_id = :game-id
),

-- 1) Списывание денег со счета аккаунта происходит, только если баланса достаточно
--    и игры еще нет в библиотеке
update_balance AS (
    UPDATE accounts
    SET balance = balance - (SELECT price FROM games WHERE game_id = :game_id)
    WHERE account_id = :account_id
        AND balance >= (SELECT price FROM games WHERE game_id = :game_id)
        AND NOT EXISTS (SELECT 1 FROM check_library)
    RETURNING account_id  -- вернет account_id, если условия удовлетворены
), 

-- 2) Получаем данные о разработчике и издателе игры
game_details AS (
    SELECT dev_id, publish_id FROM games WHERE game_id =: game_id
)

-- 3) Добавляем игру в библиотеку
INSERT INTO library (account_id, game_id, dev_id, publish_id) 
SELECT :account_id, :game_id, game_details.dev_id, game_details.publish_id FROM game_details
-- 4) Проверка: покупка совершилась => баланс обновлен в пункте 1)
--    если условию EXISTS соответствуют строки, то SELECT вернет 1 для каждой вместо чтения рельных данных
WHERE EXISTS (SELECT 1 FROM update_balance)  

-- 4. Обновление playtime_hours
UPDATE library 
SET playtime_hours = playtime_hours + :session_hours
WHERE account_id = :account_id AND game_id = :game_id

-- 5. Оставление отзыва по игре (rating, review_text)
INSERT INTO game_reviews (game_id, account_id, rating, review_text)
-- SELECT (+ WHERE) здесь это способ сделать INSERT условным
SELECT (:game_id, :account_id, :rating,:review_text)  
-- Проверка того, что игра есть в library
WHERE EXISTS (  
    SELECT 1 FROM library 
    WHERE game_id = :game_id AND account_id = :account_id
)
-- Если отзыв уже есть, обновляем текст и оценку
ON CONFLICT (game_id, account_id)
DO UPDATE SET 
    rating = EXCLUDED.rating,  -- EXCLUDED это новая запись
    review_text = EXCLUDED.review_text,
    review_date = CURRENT_DATE;