/**
 * Unit tests for GET /health
 *
 * Tests the handler function directly — no server or Docker required.
 * The handler is a plain function that returns a Response; this is testable
 * without running SvelteKit.
 */

import { describe, expect, it } from "vitest";
import { GET } from "../../../src/routes/health/+server.js";

describe("GET /health", () => {
  it("returns HTTP 200", () => {
    const response = GET();
    expect(response.status).toBe(200);
  });

  it("returns ok: true in the JSON body", async () => {
    const response = GET();
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("returns the service name in the body", async () => {
    const response = GET();
    const body = await response.json();
    expect(body.service).toBe("job-ops-web");
  });

  it("returns a version string", async () => {
    const response = GET();
    const body = await response.json();
    expect(typeof body.version).toBe("string");
    expect(body.version.length).toBeGreaterThan(0);
  });

  it("sets Content-Type to application/json", () => {
    const response = GET();
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("is a pure function — returns a fresh Response on each call", () => {
    const r1 = GET();
    const r2 = GET();
    expect(r1).not.toBe(r2);
  });
});
