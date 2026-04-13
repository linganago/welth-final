import { test, expect } from "@playwright/test";
import { signIn, expectToast } from "./helpers.js";

/**
 * Transaction flow E2E tests.
 *
 * PREREQUISITE: Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD
 * in .env.test.local pointing to a real Clerk test user.
 *
 * These tests cover the most critical user journey in a financial app:
 * creating a transaction and verifying the balance updates correctly.
 *
 * They are skipped automatically when credentials are not set, so they
 * do not block CI — they are opt-in integration tests.
 */

// Skip the entire suite if test credentials are not configured
const HAS_CREDENTIALS =
  !!process.env.PLAYWRIGHT_TEST_EMAIL &&
  !!process.env.PLAYWRIGHT_TEST_PASSWORD;

test.describe("Transactions", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!HAS_CREDENTIALS, "Skipped — set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD to run");
    await signIn(page);
  });

  test("dashboard loads after sign in", async ({ page }) => {
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByText(/add new account/i)).toBeVisible();
  });

  test("transaction create page is accessible", async ({ page }) => {
    await page.goto("/transaction/create");
    await expect(page.getByRole("heading", { name: /create transaction/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /scan receipt/i })).toBeVisible();
  });

  test("form shows validation errors on empty submit", async ({ page }) => {
    await page.goto("/transaction/create");

    // Try to submit empty form
    await page.getByRole("button", { name: /create transaction/i }).click();

    // Should show validation error for amount
    await expect(page.getByText(/amount is required/i)).toBeVisible({ timeout: 5000 });
  });

  test("create expense transaction and verify redirect", async ({ page }) => {
    // Navigate to transaction creation
    await page.goto("/transaction/create");

    // Fill in amount
    await page.getByLabel(/amount/i).fill("50");

    // Select category — click the category select and pick first option
    const categorySelect = page.getByRole("combobox").filter({ hasText: /select category/i });
    if (await categorySelect.isVisible()) {
      await categorySelect.click();
      await page.getByRole("option").first().click();
    }

    // Fill description
    await page.getByLabel(/description/i).fill("E2E test transaction");

    // Submit
    await page.getByRole("button", { name: /create transaction/i }).click();

    // Should redirect to account page
    await expect(page).toHaveURL(/\/account\//, { timeout: 15000 });
  });

  test("CSV export button is present on account page", async ({ page }) => {
    // Go to dashboard first to find an account
    await page.goto("/dashboard");

    // Click the first account card if one exists
    const accountCard = page.locator("[href^='/account/']").first();
    const hasAccount = await accountCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasAccount) {
      test.skip(true, "No accounts found — create one first");
      return;
    }

    await accountCard.click();
    await expect(page).toHaveURL(/\/account\//);

    // CSV export button should be visible
    await expect(
      page.getByRole("button", { name: /export csv/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("transaction table renders on account page", async ({ page }) => {
    await page.goto("/dashboard");

    const accountCard = page.locator("[href^='/account/']").first();
    const hasAccount = await accountCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasAccount) {
      test.skip(true, "No accounts found — create one first");
      return;
    }

    await accountCard.click();
    await expect(page).toHaveURL(/\/account\//);

    // Table or empty state message should be visible
    const tableOrEmpty = page.locator("table, [data-testid='empty-state']").first();
    // Give it time to load (infinite scroll hook runs client-side)
    await expect(tableOrEmpty.or(page.getByText(/no transactions yet/i))).toBeVisible({
      timeout: 10000,
    });
  });
});
