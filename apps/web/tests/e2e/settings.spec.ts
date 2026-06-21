/**
 * Phase 8 — Settings page E2E tests.
 *
 * Run against the built server (node build) with no MongoDB connection.
 * The settings load catches DB errors and returns an empty object, so the
 * page renders with default values.
 */

import { expect, test } from "@playwright/test";

test.describe("settings page", () => {
  test("has correct page title", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveTitle(/Settings — Job-Ops/);
  });

  test("renders the Settings heading", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("has LLM provider section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /LLM Provider/i })).toBeVisible();
  });

  test("has job search section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /Job Search/i })).toBeVisible();
  });

  test("has RxResume section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /RxResume/i })).toBeVisible();
  });

  test("LLM provider select is visible", async ({ page }) => {
    await page.goto("/settings");
    const select = page.getByRole("combobox");
    await expect(select.first()).toBeVisible();
  });

  test("Save Settings button is visible", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: /save settings/i })).toBeVisible();
  });

  test("has app navigation sidebar", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("link", { name: /jobs/i })).toBeVisible();
  });
});
