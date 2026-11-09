import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.jsx";

// Build a small fetch-like response for mocking the backend.
function jsonResponse(data, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: vi.fn().mockResolvedValue(data)
    };
}

const sampleGame = {
    game_id: 1,
    title: "Hades II",
    release_date: "2025-09-25",
    genre: "Action",
    price: 29.99
};

beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("GameStore catalog", () => {
    it("loads and displays games returned by the API", async () => {
        fetch.mockResolvedValueOnce(jsonResponse([sampleGame]));

        render(<App />);

        expect(
            await screen.findByRole("heading", { name: "Hades II" })
        ).toBeInTheDocument();
        expect(screen.getByText("Action")).toBeInTheDocument();
        expect(screen.getByText("$29.99")).toBeInTheDocument();
        expect(fetch).toHaveBeenCalledWith("/api/games");
    });

    it("shows an error and lets the visitor retry loading the catalog", async () => {
        const user = userEvent.setup();
        fetch
            .mockRejectedValueOnce(new Error("Network unavailable"))
            .mockResolvedValueOnce(jsonResponse([sampleGame]));

        render(<App />);

        expect(
            await screen.findByText("Could not load the game catalog.")
        ).toBeInTheDocument();
        expect(screen.getByText("Network unavailable")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Try again" }));

        expect(
            await screen.findByRole("heading", { name: "Hades II" })
        ).toBeInTheDocument();
    });
});

describe("Registration and login", () => {
    it("submits registration data and switches back to the login form", async () => {
        const user = userEvent.setup();
        fetch
            .mockResolvedValueOnce(jsonResponse([]))
            .mockResolvedValueOnce(jsonResponse(
                { message: "Account created" },
                201
            ));

        render(<App />);

        await screen.findByRole("heading", { name: "Game catalog" });
        await user.click(screen.getByRole("button", { name: "Register" }));

        await user.type(screen.getByLabelText("Username"), "new_player");
        await user.type(
            screen.getByLabelText("Email"),
            "new_player@example.com"
        );
        await user.type(screen.getByLabelText("Password"), "testPassword123");
        await user.click(
            screen.getByRole("button", { name: "Create account" })
        );

        expect(
            await screen.findByText("Account created! You can now log in.")
        ).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Welcome back" }))
            .toBeInTheDocument();
        expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
        expect(screen.getByLabelText("Username")).toHaveValue("new_player");
        expect(screen.getByLabelText("Password")).toHaveValue("");

        const [requestUrl, requestOptions] = fetch.mock.calls[1];
        expect(requestUrl).toBe("/api/register");
        expect(requestOptions.method).toBe("POST");
        expect(requestOptions.headers["Content-Type"]).toBe("application/json");
        expect(JSON.parse(requestOptions.body)).toEqual({
            username: "new_player",
            email: "new_player@example.com",
            password: "testPassword123"
        });
    });

    it("logs in, stores the JWT token, and displays the account", async () => {
        const user = userEvent.setup();
        const accessToken = "test-access-token";
        fetch
            .mockResolvedValueOnce(jsonResponse([]))
            .mockResolvedValueOnce(jsonResponse({
                access_token: accessToken,
                token_type: "bearer",
                username: "player_one",
                role: "user"
            }));

        render(<App />);

        await user.type(screen.getByLabelText("Username"), "player_one");
        await user.type(screen.getByLabelText("Password"), "correctPassword");

        const loginForm = screen.getByLabelText("Password").closest("form");
        await user.click(within(loginForm).getByRole("button", { name: "Log in" }));

        expect(
            await screen.findByRole("heading", { name: "Hello, player_one!" })
        ).toBeInTheDocument();
        expect(screen.getByText("user")).toBeInTheDocument();
        expect(sessionStorage.getItem("access_token")).toBe(accessToken);

        const [requestUrl, requestOptions] = fetch.mock.calls[1];
        expect(requestUrl).toBe("/api/login");
        expect(requestOptions.method).toBe("POST");
        expect(requestOptions.headers["Content-Type"])
            .toBe("application/x-www-form-urlencoded");
        expect(requestOptions.body.get("username")).toBe("player_one");
        expect(requestOptions.body.get("password")).toBe("correctPassword");
    });

    it("displays the backend error when login fails", async () => {
        const user = userEvent.setup();
        fetch
            .mockResolvedValueOnce(jsonResponse([]))
            .mockResolvedValueOnce(jsonResponse(
                { detail: "Incorrect username or password" },
                401
            ));

        render(<App />);

        await user.type(screen.getByLabelText("Username"), "unknown_player");
        await user.type(screen.getByLabelText("Password"), "wrongPassword");

        const loginForm = screen.getByLabelText("Password").closest("form");
        await user.click(within(loginForm).getByRole("button", { name: "Log in" }));

        expect(
            await screen.findByText("Incorrect username or password")
        ).toBeInTheDocument();
        expect(sessionStorage.getItem("access_token")).toBeNull();
    });

    it("restores a saved session and removes an invalid token", async () => {
        sessionStorage.setItem("access_token", "expired-token");
        fetch.mockImplementation(async (url) => {
            if (url === "/api/games") {
                return jsonResponse([]);
            }
            if (url === "/api/me") {
                return jsonResponse({ detail: "Invalid token" }, 401);
            }
            throw new Error(`Unexpected request: ${url}`);
        });

        render(<App />);

        expect(await screen.findByText("Browsing as guest"))
            .toBeInTheDocument();
        await waitFor(() => {
            expect(sessionStorage.getItem("access_token")).toBeNull();
        });
        expect(fetch).toHaveBeenCalledWith("/api/me", {
            headers: { Authorization: "Bearer expired-token" }
        });
    });
});

describe("Publisher functionality", () => {
    it("shows the publishing form only to publishers", async () => {
        sessionStorage.setItem("access_token", "publisher-token");
        fetch.mockImplementation(async (url) => {
            if (url === "/api/games") {
                return jsonResponse([]);
            }
            if (url === "/api/me") {
                return jsonResponse({ username: "game_publisher", role: "publisher" });
            }
            throw new Error(`Unexpected request: ${url}`);
        });

        render(<App />);

        expect(
            await screen.findByRole("heading", { name: "Publish a game" })
        ).toBeInTheDocument();
        expect(screen.getByText("publisher")).toBeInTheDocument();
    });

    it("does not show the publishing form to an ordinary user", async () => {
        sessionStorage.setItem("access_token", "user-token");
        fetch.mockImplementation(async (url) => {
            if (url === "/api/games") {
                return jsonResponse([]);
            }
            if (url === "/api/me") {
                return jsonResponse({ username: "regular_player", role: "user" });
            }
            throw new Error(`Unexpected request: ${url}`);
        });

        render(<App />);

        expect(
            await screen.findByRole("heading", { name: "Hello, regular_player!" })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("heading", { name: "Publish a game" })
        ).not.toBeInTheDocument();
    });

    it("publishes a game and reloads the catalog", async () => {
        const user = userEvent.setup();
        const token = "publisher-token";
        const newGame = {
            game_id: 2,
            title: "New Adventure",
            release_date: "2026-06-15",
            genre: "Adventure",
            price: 24.99
        };
        let catalogRequestCount = 0;

        sessionStorage.setItem("access_token", token);
        fetch.mockImplementation(async (url, options = {}) => {
            if (url === "/api/me") {
                return jsonResponse({ username: "game_publisher", role: "publisher" });
            }

            if (url === "/api/games" && options.method === "POST") {
                return jsonResponse(newGame, 200);
            }

            if (url === "/api/games") {
                catalogRequestCount += 1;
                return jsonResponse(catalogRequestCount === 1 ? [] : [newGame]);
            }

            throw new Error(`Unexpected request: ${url}`);
        });

        render(<App />);

        const titleInput = await screen.findByLabelText("Game title");
        await user.type(titleInput, newGame.title);
        fireEvent.change(screen.getByLabelText("Release date"), {
            target: { value: newGame.release_date }
        });
        await user.type(screen.getByLabelText("Genre"), newGame.genre);
        await user.type(screen.getByLabelText("Price (USD)"), String(newGame.price));

        const publishForm = titleInput.closest("form");
        await user.click(
            within(publishForm).getByRole("button", { name: "Publish game" })
        );

        expect(
            await screen.findByText('"New Adventure" was successfully published!')
        ).toBeInTheDocument();
        expect(
            await screen.findByRole("heading", { name: "New Adventure" })
        ).toBeInTheDocument();

        const publishCall = fetch.mock.calls.find(
            ([url, options]) => url === "/api/games" && options?.method === "POST"
        );
        expect(publishCall).toBeDefined();
        expect(publishCall[1].headers.Authorization).toBe(`Bearer ${token}`);
        expect(JSON.parse(publishCall[1].body)).toEqual({
            title: newGame.title,
            release_date: newGame.release_date,
            genre: newGame.genre,
            price: newGame.price
        });
        expect(catalogRequestCount).toBe(2);
    });

    it("logs out and clears the saved token", async () => {
        const user = userEvent.setup();
        sessionStorage.setItem("access_token", "user-token");
        fetch.mockImplementation(async (url) => {
            if (url === "/api/games") {
                return jsonResponse([]);
            }
            if (url === "/api/me") {
                return jsonResponse({ username: "regular_player", role: "user" });
            }
            throw new Error(`Unexpected request: ${url}`);
        });

        render(<App />);

        await screen.findByRole("heading", { name: "Hello, regular_player!" });
        await user.click(screen.getByRole("button", { name: "Log out" }));

        expect(await screen.findByText("Browsing as guest")).toBeInTheDocument();
        expect(sessionStorage.getItem("access_token")).toBeNull();
        expect(screen.getByRole("heading", { name: "Welcome back" }))
            .toBeInTheDocument();
    });
});
