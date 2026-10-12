#include "crow.h"
#include <pqxx/pqxx>

#include <cmath>
#include <iostream>
#include <string>

// Return an HTTP error containing JSON.
crow::response json_error(int status, const std::string& message)
{
    crow::json::wvalue body;
    body["error"] = message;

    crow::response response{status, body.dump()};
    response.set_header("Content-Type", "application/json");
    return response;
}

int main()
{
    crow::SimpleApp app;

    // Test that the backend is running.
    CROW_ROUTE(app, "/")
    ([] {
        return "GameStore backend is running!";
    });

    // API endpoint: create a new game.
    CROW_ROUTE(app, "/api/games")
    .methods(crow::HTTPMethod::Post)
    ([](const crow::request& req) -> crow::response
    {
        // 1. Read the JSON sent by React.
        auto body = crow::json::load(req.body);

        if (!body || body.t() != crow::json::type::Object)
        {
            return json_error(400, "Invalid JSON request.");
        }

        // 2. Check that all required fields exist.
        if (!body.has("title") ||
            !body.has("genre") ||
            !body.has("price"))

        {
            return json_error(400, "Missing required fields.");
        }

        // 3. Check the input types.
        if (body["title"].t() != crow::json::type::String ||
            body["genre"].t() != crow::json::type::String ||
            body["price"].t() != crow::json::type::Number)
        {
            return json_error(400, "Invalid field types.");
        }

        const std::string title = body["title"].s();
        const std::string genre = body["genre"].s();
        const double price = body["price"].d();

        if (title.empty() || title.size() > 100 ||
            genre.empty() || genre.size() > 50 ||
            !std::isfinite(price) || price < 0)
        {
            return json_error(400, "Invalid game details.");
        }

        try
        {
            // Connect to PostgreSQL running in Docker.
            pqxx::connection conn{
                "postgresql://postgres:password@localhost:5431/gamestore"
            };

            // All three inserts belong to the same transaction.
            pqxx::work tx{conn};

            // 4. Insert the game; PostgreSQL supplies today's date.
            const auto result = tx.exec(
                "INSERT INTO games "
                "(title, release_date, genre, price) "
                "VALUES ($1, CURRENT_DATE, $2, $3) "
                "RETURNING game_id",
                pqxx::params{title, genre, price}
            );

            auto game_id = result[0][0].as<int>();

            // Save all changes together.
            tx.commit();

            crow::json::wvalue output;
            output["message"] = "Game created successfully";
            output["game_id"] = game_id;

            crow::response response{201, output.dump()};
            response.set_header("Content-Type", "application/json");
            return response;
        }
        catch (const pqxx::unique_violation&)
        {
            return json_error(
                409, "A game or relationship already exists."
            );
        }
        catch (const std::exception& e)
        {
            CROW_LOG_ERROR << "Database error: " << e.what();

            return json_error(
                500, "Could not create game. Check the backend terminal."
            );
        }
    });

    app.port(8080).multithreaded().run();
}