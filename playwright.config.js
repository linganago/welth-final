import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration.
 *
 * Tests run against a locally running dev server.
 * Start the server first with: npm run dev
 *
 * Then run E2E tests with: npm run test:e2e
 *
 * For CI, the server is started automatically via `webServer` config below.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,  // Financial state tests must run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 30000,

  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],

  use: {
    // Base URL of the app
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",

    // Collect trace on first retry to help debug failures in CI
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Slow down actions in headed mode for easier debugging
    ...(process.env.PWDEBUG ? { slowMo: 500 } : {}),
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Automatically start dev server when running E2E tests
  // Comment this out if you prefer to start the server manually
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
