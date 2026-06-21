/**
 * Phase 5 — jobspy HTTP client integration tests.
 *
 * Spins up a real Node HTTP server that mimics the Python sidecar.
 * The client uses global fetch (Node 22 built-in) which makes a real
 * network call to 127.0.0.1 on a random port — no fetch mocking required.
 *
 * This validates the full HTTP round-trip: JSON serialisation, status
 * handling, and response parsing, without needing the Python process.
 */

import * as http from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { scrapeJobSpy } from "../../../../src/lib/server/services/extractors/jobspy.js";

// ─── Mock sidecar server ──────────────────────────────────────────────────────

/** Controls what the mock server will return for the next /scrape request. */
let nextScrapeStatus = 200;
let nextScrapeBody: unknown = { ok: true, data: [] };
/** Stores the last parsed request body for assertions. */
let lastRequestBody: Record<string, unknown> | null = null;

let server: http.Server;
let serverUrl: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "POST" && req.url === "/scrape") {
      let raw = "";
      req.on("data", (chunk: Buffer) => {
        raw += chunk.toString();
      });
      req.on("end", () => {
        try {
          lastRequestBody = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          lastRequestBody = null;
        }
        res.writeHead(nextScrapeStatus, { "Content-Type": "application/json" });
        res.end(JSON.stringify(nextScrapeBody));
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ detail: "Not found" }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as { port: number };
  serverUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

beforeEach(() => {
  process.env.EXTRACTOR_URL = serverUrl;
  nextScrapeStatus = 200;
  nextScrapeBody = { ok: true, data: [] };
  lastRequestBody = null;
});

afterEach(() => {
  delete process.env.EXTRACTOR_URL;
});

// ─── Request shape ────────────────────────────────────────────────────────────

describe("jobspy integration — request shape", () => {
  it("sends snake_case body to the sidecar", async () => {
    await scrapeJobSpy({
      searchTerms: ["software engineer"],
      location: "London",
      country: "UK",
      isRemote: true,
      resultsWanted: 25,
      sites: ["indeed"],
    });

    expect(lastRequestBody).toMatchObject({
      search_terms: ["software engineer"],
      location: "London",
      country: "UK",
      is_remote: true,
      results_wanted: 25,
      sites: ["indeed"],
    });
  });

  it("defaults sites to linkedin+indeed+glassdoor when not specified", async () => {
    await scrapeJobSpy({
      searchTerms: ["nurse"],
      location: "Manchester",
      country: "UK",
      isRemote: false,
      resultsWanted: 10,
    });

    expect(lastRequestBody?.sites).toEqual(["linkedin", "indeed", "glassdoor"]);
  });

  it("sends multiple search terms as an array", async () => {
    await scrapeJobSpy({
      searchTerms: ["nurse", "doctor", "pharmacist"],
      location: "Leeds",
      country: "UK",
      isRemote: false,
      resultsWanted: 10,
    });

    expect(lastRequestBody?.search_terms).toEqual(["nurse", "doctor", "pharmacist"]);
  });
});

// ─── Response parsing ─────────────────────────────────────────────────────────

describe("jobspy integration — response parsing", () => {
  it("returns the jobs array from a successful response", async () => {
    const jobs = [
      { title: "Software Engineer", company: "Acme", location: "London" },
      { title: "Backend Dev", company: "Corp", location: "Remote" },
    ];
    nextScrapeBody = { ok: true, data: jobs };

    const result = await scrapeJobSpy({
      searchTerms: ["dev"],
      location: "UK",
      country: "UK",
      isRemote: false,
      resultsWanted: 10,
    });

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Software Engineer");
    expect(result[1].company).toBe("Corp");
  });

  it("returns an empty array when data is []", async () => {
    nextScrapeBody = { ok: true, data: [] };

    const result = await scrapeJobSpy({
      searchTerms: ["dev"],
      location: "UK",
      country: "UK",
      isRemote: false,
      resultsWanted: 10,
    });

    expect(result).toEqual([]);
  });

  it("preserves null fields in RawJob records", async () => {
    nextScrapeBody = {
      ok: true,
      data: [{ title: "Dev", company: null, min_amount: null }],
    };

    const result = await scrapeJobSpy({
      searchTerms: ["dev"],
      location: "UK",
      country: "UK",
      isRemote: false,
      resultsWanted: 10,
    });

    expect(result[0].company).toBeNull();
    expect(result[0].min_amount).toBeNull();
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe("jobspy integration — error handling", () => {
  it("throws when the sidecar returns 500", async () => {
    nextScrapeStatus = 500;
    nextScrapeBody = { detail: "Internal server error" };

    await expect(
      scrapeJobSpy({
        searchTerms: ["dev"],
        location: "UK",
        country: "UK",
        isRemote: false,
        resultsWanted: 10,
      }),
    ).rejects.toThrow("Extractor returned 500");
  });

  it("throws when EXTRACTOR_URL is not set", async () => {
    delete process.env.EXTRACTOR_URL;

    await expect(
      scrapeJobSpy({
        searchTerms: ["dev"],
        location: "UK",
        country: "UK",
        isRemote: false,
        resultsWanted: 10,
      }),
    ).rejects.toThrow("EXTRACTOR_URL");
  });
});
