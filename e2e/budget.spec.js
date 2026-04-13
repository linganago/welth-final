import { test, expect } from "@playwright/test";
import { signIn } from "./helpers.js";

/**
 * Budget manager E2E tests.
 *
 * Verifies the per-category budget UI renders and responds correctly.
 */

const HAS_CREDENTIALS =
  !!process.env.PLAYWRIGHT_TEST_EMAIL &&
  !!process.env.PLAYWRIGHT_TEST_PASSWORD;

test.describe("Budget Manager", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!HAS_CREDENTIALS, "Skipped — set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD to run");
    await signIn(page);
  });

  test("budget tracker card is visible on dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/budget tracker/i)).toBeVisible({ timeout: 8000 });
  });

  test("add budget button is visible", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("button", { name: /add budget/i })
    ).toBeVisible({ timeout: 8000 });
  });

  test("clicking add budget shows the form", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /add budget/i }).click();

    // The form should appear with a category selector and amount input
    await expect(
      page.getByRole("combobox").filter({ hasText: /select category|overall/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("CSV export button is visible on dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("button", { name: /export all transactions/i })
    ).toBeVisible({ timeout: 8000 });
  });
});
