/**
 * Phase 6 — Smoke tests (MVP gate).
 *
 * These tests verify that the SvelteKit application starts and responds
 * correctly to basic requests. No MongoDB connection is required because
 * the tested routes (/health and /) do not trigger tRPC procedures.
 *
 * Run after a successful `npm run build`.
 */

import { expect, test } from "@playwright/test";

// ─── /health ─────────────────────────────────────────────────────────────────

test.describe("smoke — health endpoint", () => {
  test("GET /health returns 200", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.status()).toBe(200);
  });

  test("GET /health returns ok:true and service name", async ({ request }) => {
    const res = await request.get("/health");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("job-ops-web");
  });

  test("GET /health echoes x-request-id when provided", async ({ request }) => {
    const id = "smoke-test-req-id";
    const res = await request.get("/health", {
      headers: { "x-request-id": id },
    });
    expect(res.headers()["x-request-id"]).toBe(id);
  });

  test("GET /health generates x-request-id when not provided", async ({ request }) => {
    const res = await request.get("/health");
    const header = res.headers()["x-request-id"];
    expect(header).toBeTruthy();
    // UUID v4 pattern
    expect(header).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

// ─── Root page ────────────────────────────────────────────────────────────────

test.describe("smoke — root page", () => {
  test("GET / returns 200", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
  });

  test("root page has Job-Ops title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Job-Ops/);
  });

  test("root page contains a link to /jobs", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /view jobs/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/jobs");
  });
});

// ─── tRPC endpoint ────────────────────────────────────────────────────────────
//
// tRPC procedures hit MongoDB (via Prisma). In the smoke test environment
// MongoDB may not be running, causing Prisma to hang rather than fail fast.
// Full tRPC procedure testing is covered by the integration test suite
// (tests/integration/trpc/jobs.test.ts) using MongoMemoryReplSet.
// The smoke test validates only that the HTTP handler *route* is registered
// by checking that the tRPC endpoint is not a 404.

test.describe("smoke — tRPC handler", () => {
  test("POST /api/trpc endpoint is registered (not 404)", async ({ request }) => {
    // Send a malformed request — we expect tRPC to return 400 (bad request)
    // rather than 404 (route not found). This proves the handler is wired.
    const res = await request.post("/api/trpc/jobs.list", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    // 404 would mean the route is not registered; anything else means it is.
    expect(res.status()).not.toBe(404);
  });
});
