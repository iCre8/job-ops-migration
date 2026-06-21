/**
 * Phase 4 — tRPC Settings Router Unit Tests
 *
 * Settings is a singleton — always upserted with id="singleton".
 * The `data` field is a JSON object merged on each update.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCallerFactory } from "../../../src/lib/server/trpc/init.js";
import { appRouter } from "../../../src/lib/server/trpc/routers/_app.js";
import { mockPrisma } from "../../mocks/prisma.js";

const createCaller = createCallerFactory(appRouter);

function makeCaller() {
  return createCaller({
    prisma: mockPrisma,
    requestId: "test-req-id",
    event: {} as never,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── settings.get ─────────────────────────────────────────────────────────────

describe("settings.get", () => {
  it("returns empty object when no settings document exists", async () => {
    vi.mocked(mockPrisma.settings.findFirst).mockResolvedValue(null as never);

    const caller = makeCaller();
    const result = await caller.settings.get();

    expect(result).toEqual({});
  });

  it("returns the data field when settings exist", async () => {
    vi.mocked(mockPrisma.settings.findFirst).mockResolvedValue({
      id: "singleton",
      data: { llmProvider: "openrouter", theme: "dark" },
      updatedAt: new Date(),
    } as never);

    const caller = makeCaller();
    const result = await caller.settings.get();

    expect(result).toEqual({ llmProvider: "openrouter", theme: "dark" });
  });

  it("queries with id=singleton", async () => {
    vi.mocked(mockPrisma.settings.findFirst).mockResolvedValue(null as never);

    const caller = makeCaller();
    await caller.settings.get();

    expect(mockPrisma.settings.findFirst).toHaveBeenCalledWith({
      where: { id: "singleton" },
    });
  });
});

// ─── settings.update ──────────────────────────────────────────────────────────

describe("settings.update", () => {
  it("upserts with merged data when no existing settings", async () => {
    vi.mocked(mockPrisma.settings.findFirst).mockResolvedValue(null as never);
    vi.mocked(mockPrisma.settings.upsert).mockResolvedValue({
      id: "singleton",
      data: { theme: "dark" },
      updatedAt: new Date(),
    } as never);

    const caller = makeCaller();
    await caller.settings.update({ theme: "dark" });

    expect(mockPrisma.settings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "singleton" },
        create: { id: "singleton", data: { theme: "dark" } },
        update: { data: { theme: "dark" } },
      }),
    );
  });

  it("merges new keys with existing settings", async () => {
    vi.mocked(mockPrisma.settings.findFirst).mockResolvedValue({
      id: "singleton",
      data: { theme: "light", llmProvider: "openrouter" },
      updatedAt: new Date(),
    } as never);
    vi.mocked(mockPrisma.settings.upsert).mockResolvedValue({} as never);

    const caller = makeCaller();
    await caller.settings.update({ theme: "dark" });

    expect(mockPrisma.settings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { data: { theme: "dark", llmProvider: "openrouter" } },
      }),
    );
  });

  it("new keys overwrite existing keys", async () => {
    vi.mocked(mockPrisma.settings.findFirst).mockResolvedValue({
      id: "singleton",
      data: { theme: "light" },
      updatedAt: new Date(),
    } as never);
    vi.mocked(mockPrisma.settings.upsert).mockResolvedValue({} as never);

    const caller = makeCaller();
    await caller.settings.update({ theme: "dark" });

    const [call] = vi.mocked(mockPrisma.settings.upsert).mock.calls;
    const merged = (call[0] as { update: { data: Record<string, unknown> } }).update.data;
    expect(merged.theme).toBe("dark");
  });

  it("returns the upserted settings document", async () => {
    const returned = { id: "singleton", data: { theme: "dark" }, updatedAt: new Date() };
    vi.mocked(mockPrisma.settings.findFirst).mockResolvedValue(null as never);
    vi.mocked(mockPrisma.settings.upsert).mockResolvedValue(returned as never);

    const caller = makeCaller();
    const result = await caller.settings.update({ theme: "dark" });

    expect(result).toEqual(returned);
  });
});
