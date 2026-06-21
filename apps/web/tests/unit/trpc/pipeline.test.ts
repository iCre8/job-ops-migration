/**
 * Phase 4 — tRPC Pipeline Router Unit Tests
 *
 * pipeline.trigger creates a PipelineRun record. Actual pipeline execution
 * is wired in Phase 5 (extractor sidecar). For now, trigger returns the
 * created run with status="running".
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

// ─── pipeline.list ────────────────────────────────────────────────────────────

describe("pipeline.list", () => {
  it("returns an empty array when no runs exist", async () => {
    vi.mocked(mockPrisma.pipelineRun.findMany).mockResolvedValue([] as never);

    const caller = makeCaller();
    const result = await caller.pipeline.list({});

    expect(result).toEqual([]);
  });

  it("returns runs ordered by startedAt desc", async () => {
    const runs = [
      { id: "r2", status: "completed", startedAt: new Date("2026-03-31") },
      { id: "r1", status: "completed", startedAt: new Date("2026-03-30") },
    ];
    vi.mocked(mockPrisma.pipelineRun.findMany).mockResolvedValue(runs as never);

    const caller = makeCaller();
    const result = await caller.pipeline.list({});

    expect(mockPrisma.pipelineRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { startedAt: "desc" } }),
    );
    expect(result).toHaveLength(2);
  });

  it("respects the limit input", async () => {
    vi.mocked(mockPrisma.pipelineRun.findMany).mockResolvedValue([] as never);

    const caller = makeCaller();
    await caller.pipeline.list({ limit: 5 });

    expect(mockPrisma.pipelineRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });

  it("defaults to limit=20", async () => {
    vi.mocked(mockPrisma.pipelineRun.findMany).mockResolvedValue([] as never);

    const caller = makeCaller();
    await caller.pipeline.list({});

    expect(mockPrisma.pipelineRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });
});

// ─── pipeline.byId ────────────────────────────────────────────────────────────

describe("pipeline.byId", () => {
  it("returns the run when found", async () => {
    const run = { id: "r1", status: "completed", triggeredBy: "manual" };
    vi.mocked(mockPrisma.pipelineRun.findUnique).mockResolvedValue(run as never);

    const caller = makeCaller();
    const result = await caller.pipeline.byId({ id: "r1" });

    expect(result).toEqual(run);
    expect(mockPrisma.pipelineRun.findUnique).toHaveBeenCalledWith({ where: { id: "r1" } });
  });

  it("throws NOT_FOUND when the run does not exist", async () => {
    vi.mocked(mockPrisma.pipelineRun.findUnique).mockResolvedValue(null as never);

    const caller = makeCaller();
    await expect(caller.pipeline.byId({ id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Pipeline run not found",
    });
  });

  it("throws TRPCError (not a generic Error) on missing run", async () => {
    vi.mocked(mockPrisma.pipelineRun.findUnique).mockResolvedValue(null as never);

    const caller = makeCaller();
    await expect(caller.pipeline.byId({ id: "x" })).rejects.toBeInstanceOf(TRPCError);
  });
});

// ─── pipeline.trigger ─────────────────────────────────────────────────────────

describe("pipeline.trigger", () => {
  it("creates a run with status=running", async () => {
    const created = {
      id: "new-run-id",
      status: "running",
      triggeredBy: "manual",
      startedAt: new Date(),
      jobsFound: 0,
      jobsScored: 0,
      jobsSkipped: 0,
    };
    vi.mocked(mockPrisma.pipelineRun.create).mockResolvedValue(created as never);

    const caller = makeCaller();
    const result = await caller.pipeline.trigger({});

    expect(result.status).toBe("running");
    expect(mockPrisma.pipelineRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "running" }),
      }),
    );
  });

  it("defaults triggeredBy to manual", async () => {
    vi.mocked(mockPrisma.pipelineRun.create).mockResolvedValue({
      id: "r", status: "running", triggeredBy: "manual",
    } as never);

    const caller = makeCaller();
    await caller.pipeline.trigger({});

    expect(mockPrisma.pipelineRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ triggeredBy: "manual" }),
      }),
    );
  });

  it("respects scheduler as triggeredBy", async () => {
    vi.mocked(mockPrisma.pipelineRun.create).mockResolvedValue({
      id: "r", status: "running", triggeredBy: "scheduler",
    } as never);

    const caller = makeCaller();
    await caller.pipeline.trigger({ triggeredBy: "scheduler" });

    expect(mockPrisma.pipelineRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ triggeredBy: "scheduler" }),
      }),
    );
  });

  it("returns the created run record", async () => {
    const run = { id: "r99", status: "running", triggeredBy: "webhook" };
    vi.mocked(mockPrisma.pipelineRun.create).mockResolvedValue(run as never);

    const caller = makeCaller();
    const result = await caller.pipeline.trigger({ triggeredBy: "webhook" });

    expect(result).toEqual(run);
  });
});
