/**
 * Phase 11 — Tracking page E2E tests.
 *
 * Run against the built server (node build) with no MongoDB connection.
 * The tracking page catches DB errors and renders the "not_configured" state.
 */

import { expect, test } from "@playwright/test";

test.describe("tracking page", () => {
  test("has correct page title", async ({ page }) => {
    await page.goto("/tracking");
    await expect(page).toHaveTitle(/Tracking — Job-Ops/);
  });

  test("renders the Email Tracking heading", async ({ page }) => {
    await page.goto("/tracking");
    await expect(
      page.getByRole("heading", { name: /email tracking/i }),
    ).toBeVisible();
  });

  test("shows Gmail integration status label", async ({ page }) => {
    await page.goto("/tracking");
    await expect(page.getByLabel("Gmail integration status")).toBeVisible();
  });

  test("shows messages section", async ({ page }) => {
    await page.goto("/tracking");
    await expect(page.getByRole("heading", { name: /recent messages/i })).toBeVisible();
  });

  test("has app navigation sidebar", async ({ page }) => {
    await page.goto("/tracking");
    await expect(page.getByRole("link", { name: /jobs/i })).toBeVisible();
  });
});
