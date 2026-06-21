/**
 * Unit tests — Gmail sync service (runGmailSync)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock Gmail API module ─────────────────────────────────────────────────────

vi.mock(
  "../../../../src/lib/server/services/gmail/api.js",
  () => ({
    resolveAccessToken: vi.fn(),
    listMessageIds: vi.fn(),
    getMessageMetadata: vi.fn(),
    buildSearchQuery: vi.fn().mockReturnValue("newer_than:90d subject:interview"),
  }),
);

import * as gmailApi from "../../../../src/lib/server/services/gmail/api.js";
import { runGmailSync } from "../../../../src/lib/server/services/gmail/sync.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeIntegration(overrides: Record<string, unknown> = {}) {
  return {
    id: "int-1",
    provider: "gmail",
    status: "connected",
    refreshToken: "rt",
    accessToken: "at",
    tokenExpiry: new Date(Date.now() + 3600_000),
    email: "user@test.com",
    syncRuns: [],
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makePrisma(integration = makeIntegration()) {
  return {
    postApplicationIntegration: {
      findUnique: vi.fn().mockResolvedValue(integration),
      update: vi.fn().mockResolvedValue(integration),
    },
    postApplicationMessage: {
      findFirst: vi.fn().mockResolvedValue(null), // No existing messages by default
      create: vi.fn().mockResolvedValue({ id: "pm-1" }),
    },
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(gmailApi.resolveAccessToken).mockResolvedValue({
    accessToken: "fresh-tok",
    tokenExpiry: new Date(Date.now() + 3600_000),
  });
  vi.mocked(gmailApi.listMessageIds).mockResolvedValue(["msg1", "msg2"]);
  vi.mocked(gmailApi.getMessageMetadata).mockResolvedValue({
    id: "msg1",
    subject: "Interview Invitation",
    from: "recruiter@co.com",
    receivedAt: new Date("2026-01-15T10:00:00Z"),
    snippet: "We invite you for an interview",
  });
});

afterEach(() => vi.clearAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runGmailSync", () => {
  it("returns discovered and stored counts", async () => {
    const prisma = makePrisma();
    const summary = await runGmailSync("int-1", prisma as any);
    expect(summary.discovered).toBe(2);
    expect(summary.stored).toBe(2);
    expect(summary.errored).toBe(0);
  });

  it("skips already-stored messages", async () => {
    const prisma = makePrisma();
    // First message is already in DB
    vi.mocked(prisma.postApplicationMessage.findFirst)
      .mockResolvedValueOnce({ id: "existing-pm" } as any)
      .mockResolvedValue(null);

    const summary = await runGmailSync("int-1", prisma as any);
    expect(summary.stored).toBe(1); // Only second message stored
    expect(prisma.postApplicationMessage.create).toHaveBeenCalledTimes(1);
  });

  it("throws when integration is not found", async () => {
    const prisma = makePrisma();
    vi.mocked(prisma.postApplicationIntegration.findUnique).mockResolvedValue(null);

    await expect(runGmailSync("bad-id", prisma as any)).rejects.toThrow(
      /not found/,
    );
  });

  it("throws when integration has no refresh token", async () => {
    const prisma = makePrisma(makeIntegration({ refreshToken: null }));
    await expect(runGmailSync("int-1", prisma as any)).rejects.toThrow(
      /refresh token/,
    );
  });

  it("persists refreshed token after resolveAccessToken", async () => {
    const prisma = makePrisma();
    await runGmailSync("int-1", prisma as any);

    // First update call should persist the refreshed token
    expect(prisma.postApplicationIntegration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "int-1" },
        data: expect.objectContaining({ accessToken: "fresh-tok" }),
      }),
    );
  });

  it("records a sync run in the integration document", async () => {
    const prisma = makePrisma();
    await runGmailSync("int-1", prisma as any);

    // Last update call should include syncRuns.push
    const calls = vi.mocked(prisma.postApplicationIntegration.update).mock.calls;
    const syncRunCall = calls.find(
      ([arg]) => (arg as any).data?.syncRuns !== undefined,
    );
    expect(syncRunCall).toBeDefined();
    const data = (syncRunCall![0] as any).data;
    expect(data.syncRuns.push).toMatchObject({
      status: "completed",
      messagesFound: 2,
    });
  });

  it("counts errored messages when getMessageMetadata throws", async () => {
    vi.mocked(gmailApi.getMessageMetadata).mockRejectedValue(new Error("API timeout"));
    const prisma = makePrisma();
    const summary = await runGmailSync("int-1", prisma as any);
    expect(summary.errored).toBe(2);
    expect(summary.stored).toBe(0);
  });

  it("creates PostApplicationMessage with classification and relevance", async () => {
    const prisma = makePrisma();
    await runGmailSync("int-1", prisma as any);

    expect(prisma.postApplicationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalId: expect.any(String),
          classification: expect.any(String),
          relevance: expect.any(String),
        }),
      }),
    );
  });
});
