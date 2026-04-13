import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Use Node environment for server-action and lib tests.
    // For component tests you'd switch to "jsdom" or "happy-dom".
    environment: "node",

    // Auto-import Vitest globals (describe, it, expect, vi, beforeEach…)
    globals: true,

    // Run setup file before every test suite
    setupFiles: ["./vitest.setup.js"],

    exclude: [
  "**/node_modules/**",
  "**/dist/**",
  "e2e/**",               // Playwright files — run with: npx playwright test
  "__tests__/actions/**", // Integration tests — run with: npm run test:integration
],

    // Collect coverage with V8 (fast, no Babel required)
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/**", "actions/**"],
      exclude: ["lib/inngest/**", "**/__tests__/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
