/**
 * Phase 5 — jobspy HTTP client unit tests.
 *
 * fetch is mocked via vi.stubGlobal so no real HTTP is made.
 * Each test restores the global after itself via vi.unstubAllGlobals()
 * in afterEach.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scrapeJobSpy } from "../../../../src/lib/server/services/extractors/jobspy.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOkResponse(data: unknown): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function makeErrorResponse(status: number, detail = "error"): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const defaultOptions = {
  searchTerms: ["software engineer"],
  location: "London",
  country: "UK",
  isRemote: false,
  resultsWanted: 20,
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.EXTRACTOR_URL = "http://extractor:8000";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.EXTRACTOR_URL;
});

// ─── Missing env var ──────────────────────────────────────────────────────────

describe("scrapeJobSpy — env var guard", () => {
  it("throws when EXTRACTOR_URL is not set", async () => {
    delete process.env.EXTRACTOR_URL;
    await expect(scrapeJobSpy(defaultOptions)).rejects.toThrow("EXTRACTOR_URL");
  });
});

// ─── Success path ─────────────────────────────────────────────────────────────

describe("scrapeJobSpy — success", () => {
  it("returns the data array from the sidecar response", async () => {
    const jobs = [{ title: "Engineer", company: "Acme" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOkResponse(jobs)));

    const result = await scrapeJobSpy(defaultOptions);

    expect(result).toEqual(jobs);
  });

  it("returns an empty array when data is []", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOkResponse([])));

    const result = await scrapeJobSpy(defaultOptions);

    expect(result).toHaveLength(0);
  });

  it("POSTs to ${EXTRACTOR_URL}/scrape", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse([]));
    vi.stubGlobal("fetch", mockFetch);

    await scrapeJobSpy(defaultOptions);

    const [calledUrl] = mockFetch.mock.calls[0] as [string];
    expect(calledUrl).toBe("http://extractor:8000/scrape");
  });

  it("uses the POST method", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse([]));
    vi.stubGlobal("fetch", mockFetch);

    await scrapeJobSpy(defaultOptions);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
  });

  it("sets Content-Type: application/json", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse([]));
    vi.stubGlobal("fetch", mockFetch);

    await scrapeJobSpy(defaultOptions);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });
});

// ─── Request body mapping ─────────────────────────────────────────────────────

describe("scrapeJobSpy — request body shape", () => {
  it("maps camelCase options to snake_case body", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse([]));
    vi.stubGlobal("fetch", mockFetch);

    await scrapeJobSpy({
      searchTerms: ["nurse"],
      location: "Manchester",
      country: "UK",
      isRemote: true,
      resultsWanted: 30,
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(body.search_terms).toEqual(["nurse"]);
    expect(body.location).toBe("Manchester");
    expect(body.country).toBe("UK");
    expect(body.is_remote).toBe(true);
    expect(body.results_wanted).toBe(30);
  });

  it("defaults sites to linkedin, indeed, glassdoor when not specified", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse([]));
    vi.stubGlobal("fetch", mockFetch);

    await scrapeJobSpy(defaultOptions);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.sites).toEqual(["linkedin", "indeed", "glassdoor"]);
  });

  it("forwards custom sites array to the body", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse([]));
    vi.stubGlobal("fetch", mockFetch);

    await scrapeJobSpy({ ...defaultOptions, sites: ["indeed"] });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.sites).toEqual(["indeed"]);
  });

  it("supports multiple search terms", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse([]));
    vi.stubGlobal("fetch", mockFetch);

    await scrapeJobSpy({ ...defaultOptions, searchTerms: ["nurse", "doctor"] });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.search_terms).toEqual(["nurse", "doctor"]);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe("scrapeJobSpy — error handling", () => {
  it("throws when the sidecar returns 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeErrorResponse(500)));

    await expect(scrapeJobSpy(defaultOptions)).rejects.toThrow("Extractor returned 500");
  });

  it("throws when the sidecar returns 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeErrorResponse(404)));

    await expect(scrapeJobSpy(defaultOptions)).rejects.toThrow("Extractor returned 404");
  });

  it("throws when fetch itself rejects (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(scrapeJobSpy(defaultOptions)).rejects.toThrow("ECONNREFUSED");
  });
});
