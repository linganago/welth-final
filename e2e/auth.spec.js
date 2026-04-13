import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("landing page is publicly accessible", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/welth/i);
    await expect(
      page.getByRole("heading", { name: /finance/i }).first()
    ).toBeVisible();
  });

  test("unauthenticated users are redirected from /dashboard to /sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    // Clerk middleware redirects unauthenticated users to /sign-in.
    // We wait up to 15 seconds to allow for the middleware redirect chain
    // (Next.js server action → Clerk → 303 → /sign-in).
    await expect(page).toHaveURL(/sign-in/, { timeout: 15000 });
  });

  test("unauthenticated users cannot access /account routes", async ({ page }) => {
    // When hitting /account/some-id without auth:
    // - If Clerk middleware is active: redirects to /sign-in (303)
    // - If page throws UnauthorizedError: Next.js shows error page
    // Either way, the user should NOT be on /account/some-id
    const response = await page.goto("/account/some-id");

    // Accept either: redirected to sign-in OR got an error response
    // The important thing is they cannot see account data
    const currentUrl = page.url();
    const statusOk =
      currentUrl.includes("sign-in") ||
      (response && response.status() >= 400);

    expect(statusOk).toBe(true);
  });

  test("sign-in page renders correctly", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator("form").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/email/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("sign-up page renders correctly", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.locator("form").first()).toBeVisible({ timeout: 10000 });
  });
});