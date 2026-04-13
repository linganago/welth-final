import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "integration",
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.js"],

    // IMPORTANT: Only include action integration tests.
    // DO NOT change this to __tests__/**/* — that would also run unit tests
    // which have different mock requirements and no DB setup.
    include: ["__tests__/actions/**/*.{test,spec}.js"],

    // Integration tests hit a real Postgres container — give them more time
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
