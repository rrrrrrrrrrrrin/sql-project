// Importing vitest instead of vite as before 
// allows the configuration to recognize Vitest-specific options such as test, 
// while preserving my existing Vite configuration
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],

    server: {
        host: "localhost",
        port: 5173,
        strictPort: true,
        proxy: {
            "/api": {
                target: "http://localhost:8080",
                changeOrigin: true
            }
        }
    },

    // Vitest configuration
    test: {
        environment: "jsdom",
        setupFiles: "./tests/setup.js",
        clearMocks: true,
        restoreMocks: true
    }
});