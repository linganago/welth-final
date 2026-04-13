import { test, expect } from "@playwright/test";

/**
 * Auth flow tests.
 *
 * These tests verify that:
 * 1. The landing page is publicly accessible
 * 2. Unauthenticated users are redirected to sign-in when hitting protected routes
 * 3. The sign-in page renders Clerk's UI
 */

test.describe("Authentication", () => {
  test("landing page is publicly accessible", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/welth/i);

    // Hero section should be visible
    await expect(
      page.getByRole("heading", { name: /finance/i }).first()
    ).toBeVisible();
  });

  test("unauthenticated users are redirected from /dashboard to /sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/, { timeout: 10000 });
  });

  test("unauthenticated users are redirected from /account to /sign-in", async ({ page }) => {
    await page.goto("/account/some-id");
    await expect(page).toHaveURL(/sign-in/, { timeout: 10000 });
  });

  test("sign-in page renders correctly", async ({ page }) => {
    await page.goto("/sign-in");
    // Clerk renders a form — verify it loaded
    await expect(page.locator("form").first()).toBeVisible({ timeout: 10000 });
    // Should have an email input field
    await expect(page.getByLabel(/email/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("sign-up page renders correctly", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.locator("form").first()).toBeVisible({ timeout: 10000 });
  });
});
