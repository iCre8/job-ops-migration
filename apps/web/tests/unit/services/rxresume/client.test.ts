/**
 * Unit tests — RxResume v4 HTTP client
 *
 * All HTTP calls are intercepted via vi.stubGlobal("fetch", …).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteResume,
  importResume,
  login,
  printResume,
} from "../../../../src/lib/server/services/rxresume/client.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
      json: async () => body,
    } as Response),
  );
}

afterEach(() => vi.unstubAllGlobals());

// ── login ─────────────────────────────────────────────────────────────────────

describe("login", () => {
  it("returns access token from top-level accessToken field", async () => {
    mockFetch(200, { accessToken: "tok-123" });
    const token = await login("user@example.com", "pass", "http://rx.test");
    expect(token).toBe("tok-123");
  });

  it("returns token from nested data.accessToken", async () => {
    mockFetch(200, { data: { accessToken: "nested-tok" } });
    const token = await login("u", "p", "http://rx.test");
    expect(token).toBe("nested-tok");
  });

  it("throws on non-200 response", async () => {
    mockFetch(401, { message: "Invalid credentials" });
    await expect(login("u", "p", "http://rx.test")).rejects.toThrow(
      /HTTP 401/,
    );
  });

  it("throws when response body contains no token", async () => {
    mockFetch(200, { ok: true });
    await expect(login("u", "p", "http://rx.test")).rejects.toThrow(
      /no access token/,
    );
  });

  it("sends identifier and password in POST body", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ accessToken: "t" }),
    } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    await login("user@test.com", "secret", "http://rx.test");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://rx.test/api/auth/login");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.identifier).toBe("user@test.com");
    expect(body.password).toBe("secret");
  });
});

// ── importResume ──────────────────────────────────────────────────────────────

describe("importResume", () => {
  it("returns resume ID from top-level id field", async () => {
    mockFetch(200, { id: "resume-abc" });
    const id = await importResume("tok", "http://rx.test", { data: {} });
    expect(id).toBe("resume-abc");
  });

  it("returns resume ID from nested data.id", async () => {
    mockFetch(200, { data: { id: "nested-id" } });
    const id = await importResume("tok", "http://rx.test", { data: {} });
    expect(id).toBe("nested-id");
  });

  it("throws on non-200 response", async () => {
    mockFetch(422, "Unprocessable entity");
    await expect(
      importResume("tok", "http://rx.test", { data: {} }),
    ).rejects.toThrow(/HTTP 422/);
  });

  it("throws when response contains no ID", async () => {
    mockFetch(200, { ok: true });
    await expect(
      importResume("tok", "http://rx.test", { data: {} }),
    ).rejects.toThrow(/no resume ID/);
  });

  it("sets Authorization header", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ id: "r1" }),
    } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    await importResume("my-token", "http://rx.test", { data: { foo: 1 } });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer my-token",
    );
  });
});

// ── printResume ───────────────────────────────────────────────────────────────

describe("printResume", () => {
  it("returns PDF URL from top-level url field", async () => {
    mockFetch(200, { url: "https://cdn.example.com/resume.pdf" });
    const url = await printResume("tok", "http://rx.test", "resume-1");
    expect(url).toBe("https://cdn.example.com/resume.pdf");
  });

  it("returns PDF URL from href field", async () => {
    mockFetch(200, { href: "https://cdn.example.com/resume.pdf" });
    const url = await printResume("tok", "http://rx.test", "resume-1");
    expect(url).toBe("https://cdn.example.com/resume.pdf");
  });

  it("returns URL from nested data.url", async () => {
    mockFetch(200, { data: { url: "https://cdn.example.com/r.pdf" } });
    const url = await printResume("tok", "http://rx.test", "resume-1");
    expect(url).toBe("https://cdn.example.com/r.pdf");
  });

  it("throws on non-200 response", async () => {
    mockFetch(500, "Internal error");
    await expect(printResume("tok", "http://rx.test", "r1")).rejects.toThrow(
      /HTTP 500/,
    );
  });

  it("throws when response contains no URL", async () => {
    mockFetch(200, { ok: true });
    await expect(printResume("tok", "http://rx.test", "r1")).rejects.toThrow(
      /no PDF URL/,
    );
  });

  it("encodes the resume ID in the URL", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ url: "https://cdn.example.com/r.pdf" }),
    } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    await printResume("tok", "http://rx.test", "id with spaces");

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain("id%20with%20spaces");
  });
});

// ── deleteResume ──────────────────────────────────────────────────────────────

describe("deleteResume", () => {
  it("resolves on 200", async () => {
    mockFetch(200, {});
    await expect(
      deleteResume("tok", "http://rx.test", "r1"),
    ).resolves.toBeUndefined();
  });

  it("resolves on 204 (No Content)", async () => {
    mockFetch(204, "");
    await expect(
      deleteResume("tok", "http://rx.test", "r1"),
    ).resolves.toBeUndefined();
  });

  it("throws on 404", async () => {
    mockFetch(404, "Not found");
    await expect(deleteResume("tok", "http://rx.test", "r1")).rejects.toThrow(
      /HTTP 404/,
    );
  });

  it("sends DELETE method", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({}),
    } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    await deleteResume("tok", "http://rx.test", "r1");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });
});
