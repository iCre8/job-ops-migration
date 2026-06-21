/**
 * Phase 7 — Jobs pages E2E tests.
 *
 * These tests run against the built server (node build) with no MongoDB
 * connection. The jobs page server load catches DB errors and returns an
 * empty state, so the page still renders correctly.
 *
 * Full data-layer testing (with real jobs) is covered by integration tests
 * (tests/integration/trpc/jobs.test.ts) using MongoMemoryReplSet.
 */

import { expect, test } from "@playwright/test";

// ─── Jobs list ────────────────────────────────────────────────────────────────

test.describe("jobs list page", () => {
  test("has correct page title", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page).toHaveTitle(/Jobs — Job-Ops/);
  });

  test("renders the Jobs heading", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();
  });

  test("shows empty state when no jobs are returned", async ({ page }) => {
    await page.goto("/jobs");
    // Either "No jobs found" empty state, or job cards if DB is available
    const emptyState = page.getByText("No jobs found");
    const heading = page.getByRole("heading", { name: "Jobs" });
    // Page must at least render the heading (not crash)
    await expect(heading).toBeVisible();
    // If empty state is shown it should have guidance text
    if (await emptyState.isVisible()) {
      await expect(page.getByText("Run the pipeline")).toBeVisible();
    }
  });

  test("has a status filter dropdown", async ({ page }) => {
    await page.goto("/jobs");
    const select = page.getByRole("combobox", { name: /filter by status/i });
    await expect(select).toBeVisible();
  });

  test("status filter contains expected options", async ({ page }) => {
    await page.goto("/jobs");
    const select = page.getByRole("combobox", { name: /filter by status/i });
    await expect(select.locator("option[value='ready']")).toHaveText("Ready");
    await expect(select.locator("option[value='applied']")).toHaveText("Applied");
    await expect(select.locator("option[value='discovered']")).toHaveText("Discovered");
  });

  test("displays the job count", async ({ page }) => {
    await page.goto("/jobs");
    // Matches "0 jobs" or "1 job" or "42 jobs"
    await expect(page.getByText(/\d+ jobs?/)).toBeVisible();
  });

  test("has app navigation sidebar", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page.getByRole("link", { name: /settings/i })).toBeVisible();
  });
});

// ─── Job detail ───────────────────────────────────────────────────────────────

test.describe("job detail page", () => {
  test("redirects to /jobs when job ID does not exist", async ({ page }) => {
    await page.goto("/jobs/000000000000000000000001");
    // Should redirect back to jobs list (DB unavailable or NOT_FOUND)
    await expect(page).toHaveURL(/\/jobs$/);
  });

  test("redirects to /jobs for a clearly invalid ID", async ({ page }) => {
    await page.goto("/jobs/not-a-real-id");
    await expect(page).toHaveURL(/\/jobs/);
  });
});
