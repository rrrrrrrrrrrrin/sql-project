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

    // Authentication state
    // We check whether the browser already has a saved login token
    // If it does, we use it; otherwise, the token starts empty
    const [token, setToken] = useState(
        // sessionStorage is a browser feature that stores information for the current browser tab
        // () => is a function passedas the inital state to useState, so that sessionStorage is only 
        // accessed once when the component first appears 
        () => sessionStorage.getItem("access_token") || ""  
    );

    // This variable stores information about the currently logged-in account
    const [account, setAccount] = useState(null);

    // Login and registration form
    // authMode determines whether the user is currently using the login form or registration form
    const [authMode, setAuthMode] = useState("login");

    // This state stores everything the user types into the login or registration form
    const [authForm, setAuthForm] = useState({
        username: "",
        email: "",
        password: ""
    });

    const [authLoading, setAuthLoading] = useState(false);  // whether the frontend is currently waiting for an authentication response from the backend
    const [authError, setAuthError] = useState("");  // error message to display if login or registration fails (in backend)
    const [authMessage, setAuthMessage] = useState("");  // success message to display if login or registration succeeds (in backend)

    // Publishing form
    // This state stores the information a publisher enters when creating a new game
    const [gameForm, setGameForm] = useState({
        title: "",
        release_date: "",
        genre: "",
        price: ""
    });

    const [publishLoading, setPublishLoading] = useState(false);
    const [publishError, setPublishError] = useState("");
    const [publishMessage, setPublishMessage] = useState("");

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

    // Check whether the browser already has a valid login token
    async function restoreSession() {
        // Retrieve the saved token from sessionStorage (with setItem in handleAuthSubmit)
        const savedToken = sessionStorage.getItem("access_token");

        // If there is no saved token, the user has never logged in, so we return early
        if (!savedToken) {
            return;
        }

        // Start the request to the backend to check whether the saved token is valid
        try {
            // Send an HTTP request to the backend endpoint /api/me via fetch(), 
            // which returns information about the currently logged-in account
            //
            // The await keyword tells JavaScript to wait for the HTTP response from backend
            // before continuing with the next instruction in this function
            const response = await fetch("/api/me", {
                // HTTP headers contain additional information about a request
                headers: {
                    Authorization: `Bearer ${savedToken}`
                }
            });

            // Check whether the HTTP response was successful
            if (!response.ok) {
                throw new Error("Invalid login session.");
            }

            // The backend returns the account information as JSON
            // response.json() reads the response body and converts the JSON into a JavaScript object in data
            const data = await response.json(); 

            // Restore/update 2 React state variables (so that the component displays the correct information)
            setToken(savedToken);  // restores the login token
            setAccount(data);  // restores account information (username and role)

        // Token is invalid or expired, or backend cannot be reached
        } catch (err) {
            sessionStorage.removeItem("access_token");
            setToken("");
            setAccount(null);
        }
    }
    
    // Update the login or registration form when the user types
    // The event parameter represents an event generated by the browser
    // React passes that event to our function
    function handleAuthChange(event) {
        const { name, value } = event.target;  // extract the input info (object destructuring)

        // Update the authForm state variable with the new value
        setAuthForm(previous => ({
            ...previous,  // represents the prev state of the form, preserving the other fields (username, email, password) that haven't changed

            // A computed property name: this allows JavaScript to decide 
            // which property to update based on the value of name (username, email, or password)
            [name]: value  
        }));
    }

    // Register a new account or log in to an existing account
    async function handleAuthSubmit(event) {
        // Prevent the browser from reloading the page when the form is submitted (default behavior)
        event.preventDefault();  

        // Set loading and clear previous messages
        setAuthLoading(true);
        setAuthError("");
        setAuthMessage("");

        try {
            // Using let bcs the value of response will be different depending on whether the user is registering or logging in
            let response; 

            // Registration endpoint in backend expects JSON
            if (authMode === "register") {

                // Send registration data as JSON
                // fetch() sends an HTTP request to the backend endpoint /api/register
                response = await fetch("/api/register", {
                    method: "POST",  // tells the backend that we want to submit data
                    headers: {
                        "Content-Type": "application/json"  // tells FastAPI that the request body contains JSON data
                    },
                    // JSON.stringify() converts a JavaScript object into a JSON string
                    body: JSON.stringify({
                        username: authForm.username,
                        email: authForm.email,
                        password: authForm.password
                    })
                });

                const data = await response.json();  // read the response

                // data.detail contains the error message returned by the backend if registration fails
                if (!response.ok) {
                    throw new Error(data.detail || "Registration failed.");
                }

                setAuthMessage("Account created! You can now log in.");
                
                // Switch to login form after successful registration
                // The user must log in separately using their new account after registration
                setAuthMode("login");  

                // Clear the password field after successful registration
                setAuthForm(previous => ({
                    ...previous,  // preserves the username and email fields
                    password: ""
                }));

            // Login endpoint in backend expects form-encoded data
            } else {

                // Login endpoint expects form-encoded data
                // Create form data in the format username=player1&password=myPassword123
                const formData = new URLSearchParams();

                // Add the username and password to the form data
                formData.append("username", authForm.username);
                formData.append("password", authForm.password);

                // Send the login HTTP request to the backend
                response = await fetch("/api/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"  // tells FastAPI that the data is form-encoded
                    },
                    body: formData
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.detail || "Login failed.");
                }

                // Save the JWT login token in the current browser tab
                sessionStorage.setItem("access_token", data.access_token);

                setToken(data.access_token);  // update the React token state

                // Save account information in React state
                setAccount({
                    username: data.username,
                    role: data.role
                });

                // Clear the login form after successful login
                setAuthForm({
                    username: "",
                    email: "",
                    password: ""
                });
            }

        // Possible errors include:
        //  incorrect password,
        //  username already exists (during registration),
        //  backend is unreachable
        //  unexpected response from backend
        } catch (err) {
            setAuthError(err.message || "Something went wrong.");
        } finally {  // always finish the loading state regardless of success or failure
            setAuthLoading(false);
        }
    }

    // Log out the current account
    function logout() {
        sessionStorage.removeItem("access_token");  // remove the saved token

        setToken("");  // clear the React token state
        setAccount(null);  // remove the account information from React state

        setAuthMode("login");  // return to login mode

        // Clear the login form
        setAuthForm({
            username: "",
            email: "",
            password: ""
        });

        // Clear prev messages and errors
        setPublishError("");
        setPublishMessage("");
        setAuthError("");
        setAuthMessage("");
    }

    // Update the React state whenever the publisher changes something in the publishing form
    function handleGameChange(event) {
        const { name, value } = event.target;  // extract the input info

        // Update the gameForm state variable with the new value
        setGameForm(previous => ({
            ...previous,  // preserves the other fields (title, release_date, genre, price) that haven't changed
            [name]: value
        }));
    }

    // Send a new game to the backend (publishing a game)
    async function handlePublishSubmit(event) {
        event.preventDefault();  // prevent the default form submission behavior (page reload)

        // Prepare the loading and message states
        setPublishLoading(true);
        setPublishError("");
        setPublishMessage("");

        try {
            // Send the HTTP request to the backend endpoint /api/games (def publish_game()) 
            // to publish a new game
            const response = await fetch("/api/games", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",

                    // FastAPI:
                    // 1. OAuth2PasswordBearer extracts the token
                    // 2. get_current_account() verifies the token
                    // 3. require_publisher() checks the account's actual role in PostgreSQL
                    // 4. Only then can the publishing endpoint execute
                    Authorization: `Bearer ${token}`  
                },
                body: JSON.stringify({
                    title: gameForm.title,
                    release_date: gameForm.release_date,
                    genre: gameForm.genre,
                    price: Number(gameForm.price)
                })
            });

            const data = await response.json();

            // respone.ok tells us whether the HTTP status code indicates success (200–299)
            if (!response.ok) {
                throw new Error(data.detail || "Could not publish game.");
            }

            // Display a successful publishing message
            // Update the React state setPublishMessage
            setPublishMessage(
                `"${data.title}" was successfully published!`
            );

            // Clear the form
            setGameForm({
                title: "",
                release_date: "",
                genre: "",
                price: ""
            });

            // Reload the catalog to display the new game
            await loadGames();

        } catch (err) {
            setPublishError(err.message || "Something went wrong.");
        } finally {
            setPublishLoading(false);
        }
    }

    // This tells React to call loadGames() when the component App first appears on the page
    // To not have to click the "Refresh games" button to load the games on the first visit
    useEffect(() => {
        loadGames();
        restoreSession();
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

                {account ? (
                    <div className="account-summary">
                        <div>
                            <strong>{account.username}</strong>
                            <span>{account.role}</span>
                        </div>

                        {/* Refresh button */}
                        <button
                            className="refresh-button"
                            onClick={logout}
                        >
                            Log out
                        </button>
                    </div>
                ) : (
                    <span>Browsing as guest</span>
                )}
            </header>

            {/* Catalog section with the list of games */}
            <section className="catalog">

                {/* Login and registration section */}
                {!account && (
                    <section className="section-panel">

                        <h2>
                            {authMode === "login"
                                ? "Welcome back"
                                : "Create an account"}
                        </h2>

                        {/* Switch between login and registration */}
                        <div className="auth-tabs">

                            {/* Login button */}
                            <button
                                type="button"
                                onClick={() => {
                                    setAuthMode("login");
                                    setAuthError("");
                                    setAuthMessage("");
                                }}
                            >
                                Log in
                            </button>

                            {/* Registration button */}
                            <button
                                type="button"
                                onClick={() => {
                                    setAuthMode("register");
                                    setAuthError("");
                                    setAuthMessage("");
                                }}
                            >
                                Register
                            </button>

                        </div>

                        <form onSubmit={handleAuthSubmit}>

                            {/* Username */}
                            <label>
                                Username
                                <input
                                    type="text"
                                    name="username"
                                    value={authForm.username}
                                    onChange={handleAuthChange}
                                    required
                                />
                            </label>

                            {/* Email is only needed during registration */}
                            {authMode === "register" && (
                                <label>
                                    Email
                                    <input
                                        type="email"
                                        name="email"
                                        value={authForm.email}
                                        onChange={handleAuthChange}
                                        required
                                    />
                                </label>
                            )}

                            {/* Password */}
                            <label>
                                Password
                                <input
                                    type="password"
                                    name="password"
                                    value={authForm.password}
                                    onChange={handleAuthChange}
                                    required
                                />
                            </label>

                            {/* Error and success messages */}
                            {authError && (
                                <p className="error-message">{authError}</p>
                            )}

                            {authMessage && (
                                <p className="success-message">{authMessage}</p>
                            )}

                            <button
                                type="submit"
                                disabled={authLoading}
                            >
                                {authLoading
                                    ? "Please wait..."
                                    : authMode === "login"
                                        ? "Log in"
                                        : "Create account"}
                            </button>

                        </form>

                    </section>
                )}

                {/* Information for logged-in accounts */}
                {account && (
                    <section className="section-panel">

                        <h2>Hello, {account.username}!</h2>

                        {account.role === "publisher" ? (
                            <p>
                                You are logged in as a publisher.
                                You can publish games below.
                            </p>
                        ) : (
                            <p>
                                You are logged in as a user.
                                You can browse the game catalog.
                            </p>
                        )}

                    </section>
                )}

                {/* Publishing form: only displayed to publishers */}
                {account?.role === "publisher" && (
                    <section className="section-panel">

                        <h2>Publish a game</h2>

                        <p>Add a new game to the GameStore catalog.</p>

                        <form onSubmit={handlePublishSubmit}>

                            <label>
                                Game title
                                <input
                                    type="text"
                                    name="title"
                                    value={gameForm.title}
                                    onChange={handleGameChange}
                                    maxLength="100"
                                    required
                                />
                            </label>

                            <label>
                                Release date
                                <input
                                    type="date"
                                    name="release_date"
                                    value={gameForm.release_date}
                                    onChange={handleGameChange}
                                    required
                                />
                            </label>

                            <label>
                                Genre
                                <input
                                    type="text"
                                    name="genre"
                                    value={gameForm.genre}
                                    onChange={handleGameChange}
                                    maxLength="50"
                                    required
                                />
                            </label>

                            <label>
                                Price (USD)
                                <input
                                    type="number"
                                    name="price"
                                    value={gameForm.price}
                                    onChange={handleGameChange}
                                    min="0"
                                    step="0.01"
                                    required
                                />
                            </label>

                            {publishError && (
                                <p className="error-message">{publishError}</p>
                            )}

                            {publishMessage && (
                                <p className="success-message">{publishMessage}</p>
                            )}

                            <button
                                type="submit"
                                disabled={publishLoading}
                            >
                                {publishLoading ? "Publishing..." : "Publish game"}
                            </button>

                        </form>

                    </section>
                )}

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
