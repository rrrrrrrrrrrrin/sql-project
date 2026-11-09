// Provides additional DOM matchers for Vitest
import "@testing-library/jest-dom/vitest";

// Import cleanup utilities
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Clean up rendered React components after each test
afterEach(() => {
    cleanup();
});
