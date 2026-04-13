/**
 * Shared E2E test helpers.
 *
 * Authentication strategy:
 * Clerk does not expose a test mode that bypasses its UI in E2E tests.
 * The recommended approach is to create a dedicated test user in your
 * Clerk dashboard, store the credentials in environment variables, and
 * sign in through the real UI once per test file — then save the
 * browser storage state so subsequent tests skip the login screen.
 *
 * Set these in your .env.test.local file (never commit real passwords):
 *   PLAYWRIGHT_TEST_EMAIL=test@yourdomain.com
 *   PLAYWRIGHT_TEST_PASSWORD=your-test-password
 */

/**
 * Signs in via the Clerk UI and waits for dashboard redirect.
 * Call this in a `beforeAll` or `beforeEach` that needs auth.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function signIn(page) {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL;
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD in .env.test.local"
    );
  }

  await page.goto("/sign-in");

  // Clerk renders its form inside an iframe or shadow DOM depending on version.
  // We target the visible input fields directly.
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for dashboard redirect
  await page.waitForURL("/dashboard", { timeout: 15000 });
}

/**
 * Waits for a sonner toast with the given text to appear.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string|RegExp} text
 */
export async function expectToast(page, text) {
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: text })
    .waitFor({ timeout: 8000 });
}

/**
 * Creates a bank account via the UI drawer.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ name: string, type: string, balance: string }} opts
 */
export async function createAccount(page, { name, type = "SAVINGS", balance = "5000" }) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /add new account/i }).click();
  await page.getByLabel(/name/i).fill(name);
  await page.getByRole("combobox", { name: /account type/i }).click();
  await page.getByRole("option", { name: type }).click();
  await page.getByLabel(/initial balance/i).fill(balance);
  await page.getByRole("button", { name: /create account/i }).click();
  await expectToast(page, /account created/i);
}
