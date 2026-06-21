/**
 * Phase 4 — tRPC Jobs Router Unit Tests
 *
 * Uses createCallerFactory to invoke procedures directly without HTTP.
 * The Prisma client is replaced by a vi.fn() mock — no real DB required.
 */

import { TRPCError } from "@trpc/server";
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

// ─── jobs.list ────────────────────────────────────────────────────────────────

describe("jobs.list", () => {
  it("returns jobs and total count with no filter", async () => {
    const jobs = [{ id: "1", title: "Engineer", status: "ready" }];
    vi.mocked(mockPrisma.job.findMany).mockResolvedValue(jobs as never);
    vi.mocked(mockPrisma.job.count).mockResolvedValue(1);

    const caller = makeCaller();
    const result = await caller.jobs.list({});

    expect(result.jobs).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
  });

  it("passes status filter to findMany and count", async () => {
    vi.mocked(mockPrisma.job.findMany).mockResolvedValue([] as never);
    vi.mocked(mockPrisma.job.count).mockResolvedValue(0);

    const caller = makeCaller();
    await caller.jobs.list({ status: "ready" });

    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "ready" } }),
    );
    expect(mockPrisma.job.count).toHaveBeenCalledWith({ where: { status: "ready" } });
  });

  it("applies pagination skip and take correctly", async () => {
    vi.mocked(mockPrisma.job.findMany).mockResolvedValue([] as never);
    vi.mocked(mockPrisma.job.count).mockResolvedValue(0);

    const caller = makeCaller();
    await caller.jobs.list({ page: 3, pageSize: 10 });

    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it("selects only list-view fields (not full job document)", async () => {
    vi.mocked(mockPrisma.job.findMany).mockResolvedValue([] as never);
    vi.mocked(mockPrisma.job.count).mockResolvedValue(0);

    const caller = makeCaller();
    await caller.jobs.list({});

    const [call] = vi.mocked(mockPrisma.job.findMany).mock.calls;
    const arg = call[0] as { select?: Record<string, boolean> };
    expect(arg.select).toBeDefined();
    expect(arg.select?.id).toBe(true);
    expect(arg.select?.title).toBe(true);
    // Full document fields like jobDescription should not be selected
    expect(arg.select?.jobDescription).toBeUndefined();
  });

  it("orders by crawledAt descending", async () => {
    vi.mocked(mockPrisma.job.findMany).mockResolvedValue([] as never);
    vi.mocked(mockPrisma.job.count).mockResolvedValue(0);

    const caller = makeCaller();
    await caller.jobs.list({});

    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { crawledAt: "desc" } }),
    );
  });
});

// ─── jobs.byId ────────────────────────────────────────────────────────────────

describe("jobs.byId", () => {
  it("returns the job when found", async () => {
    const job = { id: "abc123", title: "Dev", status: "ready" };
    vi.mocked(mockPrisma.job.findUnique).mockResolvedValue(job as never);

    const caller = makeCaller();
    const result = await caller.jobs.byId({ id: "abc123" });

    expect(result).toEqual(job);
    expect(mockPrisma.job.findUnique).toHaveBeenCalledWith({ where: { id: "abc123" } });
  });

  it("throws NOT_FOUND when the job does not exist", async () => {
    vi.mocked(mockPrisma.job.findUnique).mockResolvedValue(null as never);

    const caller = makeCaller();
    await expect(caller.jobs.byId({ id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Job not found",
    });
  });

  it("throws TRPCError (not a generic Error) on missing job", async () => {
    vi.mocked(mockPrisma.job.findUnique).mockResolvedValue(null as never);

    const caller = makeCaller();
    await expect(caller.jobs.byId({ id: "x" })).rejects.toBeInstanceOf(TRPCError);
  });
});

// ─── jobs.update ─────────────────────────────────────────────────────────────

describe("jobs.update", () => {
  it("updates the job and returns the updated record", async () => {
    const existing = { id: "j1", title: "Dev", status: "ready" };
    const updated = { ...existing, status: "applied" };
    vi.mocked(mockPrisma.job.findUnique).mockResolvedValue(existing as never);
    vi.mocked(mockPrisma.job.update).mockResolvedValue(updated as never);

    const caller = makeCaller();
    const result = await caller.jobs.update({ id: "j1", data: { status: "applied" } });

    expect(result.status).toBe("applied");
    expect(mockPrisma.job.update).toHaveBeenCalledWith({
      where: { id: "j1" },
      data: { status: "applied" },
    });
  });

  it("throws NOT_FOUND when job does not exist", async () => {
    vi.mocked(mockPrisma.job.findUnique).mockResolvedValue(null as never);

    const caller = makeCaller();
    await expect(
      caller.jobs.update({ id: "gone", data: { status: "skipped" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not call update when job is not found", async () => {
    vi.mocked(mockPrisma.job.findUnique).mockResolvedValue(null as never);

    const caller = makeCaller();
    await expect(
      caller.jobs.update({ id: "gone", data: {} }),
    ).rejects.toBeInstanceOf(TRPCError);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it("accepts all optional update fields", async () => {
    const existing = { id: "j2", title: "Dev" };
    vi.mocked(mockPrisma.job.findUnique).mockResolvedValue(existing as never);
    vi.mocked(mockPrisma.job.update).mockResolvedValue({ ...existing } as never);

    const caller = makeCaller();
    await caller.jobs.update({
      id: "j2",
      data: {
        status: "applied",
        applicationStage: "interviewed",
        applicationNote: "Good fit",
        applicationOutcome: "pending",
        tracerLinksEnabled: true,
      },
    });

    expect(mockPrisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tracerLinksEnabled: true,
          applicationNote: "Good fit",
        }),
      }),
    );
  });
});
