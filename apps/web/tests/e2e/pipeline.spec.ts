/**
 * Phase 9 — Pipeline SSE E2E tests.
 *
 * Run against the built server (node build) with no MongoDB connection.
 *
 * Tests verify:
 *  - The SSE stream endpoint is registered and returns text/event-stream.
 *  - The "Run Pipeline" button is present on the jobs page.
 *  - The pipeline log panel is hidden until a run is triggered.
 *
 * Full pipeline execution (with real MongoDB + extractor sidecar) is an
 * integration concern outside the scope of Phase 9 E2E tests.
 */

import { expect, test } from "@playwright/test";

// ─── SSE endpoint ─────────────────────────────────────────────────────────────
//
// We use page.waitForResponse (CDP-level) rather than fetch+AbortController
// inside page.evaluate, because Chrome buffers streaming responses until
// the connection is closed — making status unavailable before abort fires.

test.describe("pipeline SSE endpoint", () => {
  test("GET /api/pipeline/stream returns text/event-stream", async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse("**/api/pipeline/stream"),
      // waitUntil:"commit" resolves when navigation is committed (headers received)
      // rather than waiting for the "load" event, which never fires on an
      // infinite SSE stream.
      page.goto("/api/pipeline/stream", { waitUntil: "commit" }),
    ]);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/event-stream");
  });

  test("SSE endpoint accepts a runId query param", async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse("**/api/pipeline/stream**"),
      page.goto("/api/pipeline/stream?runId=000000000000000000000001", { waitUntil: "commit" }),
    ]);
    expect(response.status()).toBe(200);
  });
});

// ─── Jobs page pipeline UI ────────────────────────────────────────────────────

test.describe("jobs page — pipeline controls", () => {
  test("Run Pipeline button is visible", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page.getByRole("button", { name: /run pipeline/i })).toBeVisible();
  });

  test("pipeline log panel is not shown before a run is triggered", async ({ page }) => {
    await page.goto("/jobs");
    const log = page.getByLabel("Pipeline log");
    await expect(log).not.toBeVisible();
  });
});
