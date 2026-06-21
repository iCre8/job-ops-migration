/**
 * Phase 4 — tRPC Jobs Router Integration Tests
 *
 * Uses MongoMemoryReplSet (single-node replica set) because Prisma v6 requires
 * a replica set to run transactions (deleteMany). See ISSUE-002 in issues-log.md.
 *
 * Tests the full round-trip: insert via Prisma → query/mutate via tRPC caller.
 * No HTTP layer — createCallerFactory bypasses the SvelteKit handler entirely.
 */

import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "../../../src/lib/server/trpc/init.js";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestClient } from "../../../src/lib/server/db/index.js";
import { appRouter } from "../../../src/lib/server/trpc/routers/_app.js";

// ─── Setup ────────────────────────────────────────────────────────────────────

let mongod: MongoMemoryReplSet;
let prisma: ReturnType<typeof createTestClient>;

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongod.getUri("jobops_trpc_test");
  prisma = createTestClient(uri);
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
  await mongod.stop();
});

// Delete jobs before each test (no child documents created in this suite)
beforeEach(async () => {
  await prisma.job.deleteMany();
});

function makeCaller() {
  return createCallerFactory(appRouter)({
    prisma,
    requestId: "integration-test",
    user: undefined,
    event: {} as never,
  });
}

// ─── jobs.list ────────────────────────────────────────────────────────────────

describe("jobs.list — integration", () => {
  it("returns an empty list when no jobs exist", async () => {
    const caller = makeCaller();
    const result = await caller.jobs.list({});

    expect(result.jobs).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("returns inserted jobs", async () => {
    await prisma.job.create({ data: { title: "Backend Dev", source: "manual", status: "ready" } });
    await prisma.job.create({ data: { title: "Frontend Dev", source: "manual", status: "discovered" } });

    const caller = makeCaller();
    const result = await caller.jobs.list({});

    expect(result.total).toBe(2);
    expect(result.jobs).toHaveLength(2);
  });

  it("filters jobs by status", async () => {
    await prisma.job.create({ data: { title: "Job A", source: "manual", status: "ready" } });
    await prisma.job.create({ data: { title: "Job B", source: "manual", status: "discovered" } });
    await prisma.job.create({ data: { title: "Job C", source: "manual", status: "ready" } });

    const caller = makeCaller();
    const result = await caller.jobs.list({ status: "ready" });

    expect(result.total).toBe(2);
    expect(result.jobs.every((j: { status: string }) => j.status === "ready")).toBe(true);
  });

  it("paginates correctly", async () => {
    // Unique crawledAt ensures stable ordering (crawledAt desc)
    for (let i = 1; i <= 5; i++) {
      await prisma.job.create({
        data: {
          title: `Job ${i}`,
          source: "manual",
          status: "ready",
          crawledAt: new Date(2026, 0, i),
        },
      });
    }

    const caller = makeCaller();
    const page1 = await caller.jobs.list({ page: 1, pageSize: 2 });
    const page2 = await caller.jobs.list({ page: 2, pageSize: 2 });
    const page3 = await caller.jobs.list({ page: 3, pageSize: 2 });

    expect(page1.jobs).toHaveLength(2);
    expect(page2.jobs).toHaveLength(2);
    expect(page3.jobs).toHaveLength(1);
    expect(page1.total).toBe(5);

    // All page IDs should be distinct
    const allIds = [...page1.jobs, ...page2.jobs, ...page3.jobs].map((j) => j.id);
    expect(new Set(allIds).size).toBe(5);
  });

  it("returns only list-view fields (no jobDescription)", async () => {
    await prisma.job.create({
      data: { title: "Engineer", source: "manual", status: "ready", jobDescription: "Secret content" },
    });

    const caller = makeCaller();
    const { jobs } = await caller.jobs.list({});

    const job = jobs[0];
    expect(job.title).toBe("Engineer");
    // jobDescription is not in the select — should not appear on the result type
    expect("jobDescription" in job).toBe(false);
  });
});

// ─── jobs.byId ────────────────────────────────────────────────────────────────

describe("jobs.byId — integration", () => {
  it("returns the correct job by ID", async () => {
    const created = await prisma.job.create({
      data: { title: "Senior Dev", source: "manual", status: "ready" },
    });

    const caller = makeCaller();
    const result = await caller.jobs.byId({ id: created.id });

    expect(result.id).toBe(created.id);
    expect(result.title).toBe("Senior Dev");
  });

  it("throws NOT_FOUND for a non-existent ID", async () => {
    const caller = makeCaller();
    // Use a valid MongoDB ObjectId format that doesn't exist in DB
    await expect(
      caller.jobs.byId({ id: "000000000000000000000001" }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});

// ─── jobs.update ─────────────────────────────────────────────────────────────

describe("jobs.update — integration", () => {
  it("updates the status of an existing job", async () => {
    const created = await prisma.job.create({
      data: { title: "Dev", source: "manual", status: "ready" },
    });

    const caller = makeCaller();
    const updated = await caller.jobs.update({
      id: created.id,
      data: { status: "applied" },
    });

    expect(updated.status).toBe("applied");
  });

  it("updates applicationNote and applicationStage", async () => {
    const created = await prisma.job.create({
      data: { title: "Dev", source: "manual", status: "ready" },
    });

    const caller = makeCaller();
    const updated = await caller.jobs.update({
      id: created.id,
      data: { applicationNote: "Great company", applicationStage: "applied" },
    });

    expect(updated.applicationNote).toBe("Great company");
    expect(updated.applicationStage).toBe("applied");
  });

  it("throws NOT_FOUND when updating a non-existent job", async () => {
    const caller = makeCaller();
    await expect(
      caller.jobs.update({ id: "000000000000000000000002", data: { status: "skipped" } }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("persists the update — subsequent byId reflects the change", async () => {
    const created = await prisma.job.create({
      data: { title: "Dev", source: "manual", status: "ready" },
    });

    const caller = makeCaller();
    await caller.jobs.update({ id: created.id, data: { status: "skipped" } });

    const fetched = await caller.jobs.byId({ id: created.id });
    expect(fetched.status).toBe("skipped");
  });
});
