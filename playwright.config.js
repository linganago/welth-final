import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60000, // increased for CI — server cold-start takes time

  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",

    // ---------------------------------------------------------------------------
    // Explicit user-agent — fixes ArcJet "DetectBot requires user-agent header"
    // ---------------------------------------------------------------------------
    // ArcJet's detectBot rule requires a User-Agent header. Playwright's default
    // headless Chromium sends one, but in some CI environments the header can be
    // stripped or empty. Setting it explicitly ensures ArcJet always receives a
    // valid header and does not throw.
    //
    // We use a real Chrome user-agent string so ArcJet classifies it as a
    // legitimate browser (or DRY_RUN in CI — see middleware.js).
    // ---------------------------------------------------------------------------
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",

    // Extra HTTP headers sent with every request
    extraHTTPHeaders: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Override device user-agent with our explicit one
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    },
  ],

  // Start dev server automatically when running E2E tests.
  // In CI, reuseExistingServer: false forces a fresh start every run.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    // Pipe server output so CI logs show Next.js startup errors
    stdout: "pipe",
    stderr: "pipe",
  },
});
