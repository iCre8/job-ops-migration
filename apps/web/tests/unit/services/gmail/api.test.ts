/**
 * Unit tests — Gmail API helpers
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSearchQuery,
  getMessageMetadata,
  listMessageIds,
  resolveAccessToken,
} from "../../../../src/lib/server/services/gmail/api.js";

// ── fetch mock helpers ────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: async () =>
        typeof body === "string" ? body : JSON.stringify(body),
      json: async () => body,
    } as Response),
  );
}

afterEach(() => vi.unstubAllGlobals());

// ── resolveAccessToken ────────────────────────────────────────────────────────

describe("resolveAccessToken", () => {
  it("returns cached token when still valid", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const futureExpiry = new Date(Date.now() + 120_000);
    const result = await resolveAccessToken({
      refreshToken: "rt",
      accessToken: "cached-tok",
      tokenExpiry: futureExpiry,
    });

    expect(result.accessToken).toBe("cached-tok");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refreshes when token is near-expiry", async () => {
    process.env.GMAIL_OAUTH_CLIENT_ID = "cid";
    process.env.GMAIL_OAUTH_CLIENT_SECRET = "csec";

    mockFetch(200, { access_token: "new-tok", expires_in: 3600 });

    const expiredAt = new Date(Date.now() - 1000);
    const result = await resolveAccessToken({
      refreshToken: "rt",
      accessToken: "old-tok",
      tokenExpiry: expiredAt,
    });

    expect(result.accessToken).toBe("new-tok");

    delete process.env.GMAIL_OAUTH_CLIENT_ID;
    delete process.env.GMAIL_OAUTH_CLIENT_SECRET;
  });

  it("throws when env vars are missing", async () => {
    delete process.env.GMAIL_OAUTH_CLIENT_ID;
    delete process.env.GMAIL_OAUTH_CLIENT_SECRET;

    await expect(
      resolveAccessToken({ refreshToken: "rt", accessToken: null, tokenExpiry: null }),
    ).rejects.toThrow(/GMAIL_OAUTH_CLIENT_ID/);
  });

  it("throws when refresh response has no access_token", async () => {
    process.env.GMAIL_OAUTH_CLIENT_ID = "cid";
    process.env.GMAIL_OAUTH_CLIENT_SECRET = "csec";
    mockFetch(200, { ok: true });

    await expect(
      resolveAccessToken({ refreshToken: "rt", accessToken: null, tokenExpiry: null }),
    ).rejects.toThrow(/access_token/);

    delete process.env.GMAIL_OAUTH_CLIENT_ID;
    delete process.env.GMAIL_OAUTH_CLIENT_SECRET;
  });
});

// ── listMessageIds ────────────────────────────────────────────────────────────

describe("listMessageIds", () => {
  it("returns an array of message IDs", async () => {
    mockFetch(200, {
      messages: [{ id: "msg1", threadId: "t1" }, { id: "msg2", threadId: "t2" }],
    });
    const ids = await listMessageIds("tok", "subject:interview");
    expect(ids).toEqual(["msg1", "msg2"]);
  });

  it("returns empty array when messages field is absent", async () => {
    mockFetch(200, {});
    const ids = await listMessageIds("tok", "q");
    expect(ids).toEqual([]);
  });

  it("throws on non-200 response", async () => {
    mockFetch(401, "Unauthorized");
    await expect(listMessageIds("tok", "q")).rejects.toThrow(/401/);
  });

  it("includes Authorization header", async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ messages: [] }),
    } as Response);
    vi.stubGlobal("fetch", spy);

    await listMessageIds("my-token", "q");

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer my-token",
    );
  });
});

// ── getMessageMetadata ────────────────────────────────────────────────────────

describe("getMessageMetadata", () => {
  const gmailMsg = {
    id: "msg1",
    snippet: "We would like to invite you for an interview",
    payload: {
      headers: [
        { name: "Subject", value: "Interview Invitation" },
        { name: "From", value: "recruiter@company.com" },
        { name: "Date", value: "Mon, 1 Jan 2026 10:00:00 +0000" },
      ],
    },
  };

  it("extracts subject, from, receivedAt, snippet", async () => {
    mockFetch(200, gmailMsg);
    const meta = await getMessageMetadata("tok", "msg1");
    expect(meta.id).toBe("msg1");
    expect(meta.subject).toBe("Interview Invitation");
    expect(meta.from).toBe("recruiter@company.com");
    expect(meta.snippet).toBe("We would like to invite you for an interview");
    expect(meta.receivedAt).toBeInstanceOf(Date);
  });

  it("returns null for missing headers", async () => {
    mockFetch(200, { id: "msg2", snippet: "", payload: { headers: [] } });
    const meta = await getMessageMetadata("tok", "msg2");
    expect(meta.subject).toBeNull();
    expect(meta.from).toBeNull();
    expect(meta.receivedAt).toBeNull();
  });

  it("throws on non-200 response", async () => {
    mockFetch(404, "Not found");
    await expect(getMessageMetadata("tok", "bad-id")).rejects.toThrow(/404/);
  });
});

// ── buildSearchQuery ──────────────────────────────────────────────────────────

describe("buildSearchQuery", () => {
  it("includes newer_than clause", () => {
    const q = buildSearchQuery(30);
    expect(q).toContain("newer_than:30d");
  });

  it("defaults to 90 days", () => {
    expect(buildSearchQuery()).toContain("newer_than:90d");
  });

  it("includes subject terms", () => {
    const q = buildSearchQuery();
    expect(q).toContain("interview");
  });
});
