import { useState } from "react";

function App() {
    const [form, setForm] = useState({
        title: "",
        genre: "",
        price: ""
    });

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    function handleChange(event) {
        const { name, value } = event.target;

        setForm(previous => ({
            ...previous,
            [name]: value
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setMessage("");
        setLoading(true);

        try {
            const response = await fetch("/api/games", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title: form.title.trim(),
                    genre: form.genre.trim(),
                    price: Number(form.price)
                })
            });

            const raw = await response.text();

            let result = {};

            try {
                result = raw ? JSON.parse(raw) : {};
            } catch {
                throw new Error(
                    `Server returned invalid JSON (HTTP ${response.status}): ${
                        raw || "empty response"
                    }`
                );
            }

            if (!response.ok) {
                throw new Error(
                    result.error || `Request failed (HTTP ${response.status})`
                );
            }

            if (result.game_id === undefined) {
                throw new Error(
                    "The server responded, but no game ID was returned."
                );
            }

            setMessage(
                `Success! Game ID: ${result.game_id}`
            );

            setForm({
                title: "",
                genre: "",
                price: ""
            });
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <main style={{
            maxWidth: "500px",
            margin: "40px auto",
            padding: "20px",
            fontFamily: "Arial, sans-serif"
        }}>
            <h1>GameStore</h1>
            <h2>Publish a new game</h2>

            <form onSubmit={handleSubmit}>
                <label>
                    Game title
                    <input
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                        maxLength={100}
                        required
                    />
                </label>

                <br /><br />

                <label>
                    Genre
                    <input
                        name="genre"
                        value={form.genre}
                        onChange={handleChange}
                        maxLength={50}
                        required
                    />
                </label>

                <br /><br />

                <label>
                    Price
                    <input
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.price}
                        onChange={handleChange}
                        required
                    />
                </label>

                <br /><br />

                <button type="submit" disabled={loading}>
                    {loading ? "Publishing..." : "Publish game"}
                </button>
            </form>

            {message && <p>{message}</p>}
        </main>
    );
}

export default App;