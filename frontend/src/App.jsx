// Builds the GameStore page  
// Frontend does not directly connect to PostgreSQL 
// It asks the Python backend for the games (fetch JSON),
// and then displays the data it receives

// Importing React hooks and CSS:
//  useState lets a component remember information that can change
//  useEffect lets a component run code when it first appears on the page
import { useEffect, useState } from "react";
import "./App.css";

// Returns user interface
function App() {
    // State variables to hold the list of games, 
    // loading status (whether frontend is currently waiting for a response),
    // and error message 
    //
    // useState returns the current value and a function that changes it
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);  // starts with true because page hasn't loaded its games yet
    const [error, setError] = useState("");

    // This function handles the process of getting games from the backend
    async function loadGames() {
        // Start loading and clear any previous error message
        setLoading(true);
        setError("");

        try {
            // fetch() sends an HTTP request to backend
            // This request reaches backend endpoint localhost:8080/api/games
            const response = await fetch("/api/games");

            // Check response
            if (!response.ok) {
                throw new Error(`Failed to load games (HTTP ${response.status})`);
            }

            // Python backend returns JSON,
            // response.json() reads and parses that JSON into JavaScript values,
            // data becomes an array of objects
            const data = await response.json();

            // Check that the response is an array
            if (!Array.isArray(data)) {
                throw new Error("The API did not return a list of games.");
            }

            // Save the games in React state
            // This will trigger a re-render of the component, displaying the new list of games
            setGames(data);

        // Handle errors   
        } catch (err) {
            setError(err.message || "Something went wrong.");
        // Finish loading regardless of success or failure
        } finally {
            setLoading(false);
        }
    }

    // This tells React to call loadGames() when the component App first appears on the page
    // To not have to click the "Refresh games" button to load the games on the first visit
    useEffect(() => {
        loadGames();
    }, []);

    // Building the page
    return (
        <main className="store">
            {/* Header section with title */}
            <header className="store-header">
                <div>
                    <p className="eyebrow">Games</p>
                    <h1>GameStore</h1>
                    <p className="subtitle">
                        Games table
                    </p>
                </div>

                {/* Refresh button */}
                <button
                    className="refresh-button"
                    onClick={loadGames}
                    disabled={loading}
                >
                    {loading ? "Loading..." : "Refresh games"}
                </button>
            </header>

            {/* Catalog section with the list of games */}
            <section className="catalog">
                <div className="catalog-heading">
                    <h2>Game catalog</h2>
                    {!loading && !error && (
                        <span>{games.length} games</span>
                    )}
                </div>

                {/* Show loading message while waiting for the backend response */}
                {loading && (
                    <p className="status-message">Loading games...</p>
                )}

                {/* Show error message if there was a problem loading the games */}
                {!loading && error && (
                    <div className="error-message">
                        <p>Could not load the game catalog.</p>
                        <p>{error}</p>
                        <button onClick={loadGames}>Try again</button>
                    </div>
                )}

                {/* Show a message if no games are found */}
                {!loading && !error && games.length === 0 && (
                    <p className="status-message">
                        No games found. Add some games to the games database first.
                    </p>
                )}

                {/* Show the game cards if they were successfully loaded */}
                {!loading && !error && games.length > 0 && (
                    <div className="game-grid">
                        {games.map((game) => (
                            <article
                                className="game-card"
                                key={game.game_id}
                            >
                                {/* Game info details: photo preview, genre, title, release date, and price */}
                                <div className="game-art">
                                    <span>🎮</span>
                                </div>

                                <div className="game-info">
                                    <p className="game-genre">
                                        {game.genre || "Uncategorized"}
                                    </p>

                                    <h3>{game.title}</h3>

                                    <p className="game-date">
                                        {game.release_date
                                            ? `Released ${game.release_date}`
                                            : "Release date unavailable"}
                                    </p>

                                    <p className="game-price">
                                        {game.price == null
                                            ? "Price unavailable"
                                            : Number(game.price).toLocaleString(
                                                "en-US",
                                                {
                                                    style: "currency",
                                                    currency: "USD"
                                                }
                                            )}
                                    </p>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}

export default App;  // allows another file to import this component
