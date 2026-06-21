/**
 * Phase 1 — Data Model Integration Tests
 *
 * Gate requirements:
 *   - CRUD on every collection passes
 *   - Embedded type arrays (stageEvents, tasks, interviews, tracerLinks,
 *     messages, syncRuns) round-trip correctly
 *   - Relations (Job→ChatThread, Job→TracerClickEvent, etc.) resolve correctly
 *   - Settings singleton pattern works
 *
 * Uses mongodb-memory-server — no real MongoDB required.
 */

// ISSUE-002: Prisma deleteMany() requires MongoDB transactions, which require a
// replica set. Use MongoMemoryReplSet (single-node) instead of MongoMemoryServer
// (standalone). This is required for ALL integration tests using Prisma + MongoDB.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { type PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestClient } from "../../../src/lib/server/db/index.js";

let mongod: MongoMemoryReplSet;
let prisma: PrismaClient;

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  // Single-node replica set — satisfies Prisma's transaction requirement for deleteMany()
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  // Pass the database name directly to getUri() so it is placed in the URI path
  // (before the query string), not appended after it.
  // Correct: mongodb://127.0.0.1:PORT/jobops_test?replicaSet=testset
  // Wrong:   mongodb://127.0.0.1:PORT/?replicaSet=testset/jobops_test
  const dbUri = mongod.getUri("jobops_test");
  prisma = createTestClient(dbUri);
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  // Delete in dependency order: children before parents to avoid relation violations.
  // Prisma MongoDB emulates referential integrity — parallel deletes across related
  // collections will fail if a parent is deleted before its children.
  await prisma.tracerClickEvent.deleteMany();   // references Job
  await prisma.chatRun.deleteMany();            // references ChatThread
  await prisma.chatThread.deleteMany();         // references Job
  await prisma.postApplicationMessage.deleteMany(); // references PostApplicationIntegration
  await prisma.postApplicationIntegration.deleteMany();
  await prisma.job.deleteMany();
  await prisma.pipelineRun.deleteMany();
  await prisma.settings.deleteMany();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeJob(overrides: Record<string, any> = {}) {
  return {
    title: "Senior TypeScript Engineer",
    source: "jobspy",
    employer: "Acme Corp",
    location: "Remote",
    country: "USA",
    isRemote: true,
    status: "discovered",
    jobDescription: "We are looking for a TypeScript engineer...",
    ...overrides,
  } as const;
}

// ─── Job Collection ───────────────────────────────────────────────────────────

describe("Job collection", () => {
  it("creates and retrieves a job by ID", async () => {
    const created = await prisma.job.create({ data: makeJob() });

    expect(created.id).toBeTruthy();
    expect(created.title).toBe("Senior TypeScript Engineer");
    expect(created.status).toBe("discovered");
    expect(created.isRemote).toBe(true);

    const found = await prisma.job.findUnique({ where: { id: created.id } });
    expect(found).not.toBeNull();
    expect(found!.employer).toBe("Acme Corp");
  });

  it("updates job status through the lifecycle", async () => {
    const job = await prisma.job.create({ data: makeJob() });

    const statuses = ["processing", "ready", "applied", "in_progress"] as const;
    for (const status of statuses) {
      const updated = await prisma.job.update({
        where: { id: job.id },
        data: { status },
      });
      expect(updated.status).toBe(status);
    }
  });

  it("stores and retrieves optional fields", async () => {
    const job = await prisma.job.create({
      data: makeJob({
        salaryMin: 90_000,
        salaryMax: 130_000,
        salaryCurrency: "USD",
        salaryPeriod: "yearly",
        scoreOverall: 8.5,
        scoreReasoning: "Strong match on TypeScript and remote.",
        tailoredSkills: JSON.stringify(["TypeScript", "Node.js", "React"]),
        visaSponsor: true,
      }),
    });

    expect(job.salaryMin).toBe(90_000);
    expect(job.scoreOverall).toBe(8.5);
    expect(JSON.parse(job.tailoredSkills!)).toEqual(["TypeScript", "Node.js", "React"]);
    expect(job.visaSponsor).toBe(true);
  });

  it("lists jobs filtered by status", async () => {
    await prisma.job.createMany({
      data: [
        makeJob({ status: "ready" }),
        makeJob({ status: "ready" }),
        makeJob({ status: "skipped" }),
      ],
    });

    const readyJobs = await prisma.job.findMany({ where: { status: "ready" } });
    expect(readyJobs).toHaveLength(2);

    const skipped = await prisma.job.findMany({ where: { status: "skipped" } });
    expect(skipped).toHaveLength(1);
  });

  it("deletes a job", async () => {
    const job = await prisma.job.create({ data: makeJob() });
    await prisma.job.delete({ where: { id: job.id } });

    const found = await prisma.job.findUnique({ where: { id: job.id } });
    expect(found).toBeNull();
  });
});

// ─── Embedded Types on Job ────────────────────────────────────────────────────

describe("Job embedded types", () => {
  it("stores and retrieves stageEvents[]", async () => {
    const now = new Date();
    const job = await prisma.job.create({
      data: makeJob({
        stageEvents: {
          set: [
            { id: crypto.randomUUID(), stage: "applied", timestamp: now, note: "Applied via company site" },
            { id: crypto.randomUUID(), stage: "recruiter_screen", timestamp: new Date(now.getTime() + 86_400_000), note: null },
          ],
        },
      }),
    });

    expect(job.stageEvents).toHaveLength(2);
    expect(job.stageEvents[0].stage).toBe("applied");
    expect(job.stageEvents[1].stage).toBe("recruiter_screen");
    expect(job.stageEvents[0].note).toBe("Applied via company site");
    expect(job.stageEvents[1].note).toBeNull();
  });

  it("stores and retrieves tasks[]", async () => {
    const job = await prisma.job.create({
      data: makeJob({
        tasks: {
          set: [
            {
              id: crypto.randomUUID(),
              type: "prep",
              title: "Research company background",
              dueDate: new Date("2026-04-15"),
              completedAt: null,
              createdAt: new Date(),
            },
            {
              id: crypto.randomUUID(),
              type: "follow_up",
              title: "Send thank-you email",
              dueDate: null,
              completedAt: new Date(),
              createdAt: new Date(),
            },
          ],
        },
      }),
    });

    expect(job.tasks).toHaveLength(2);
    expect(job.tasks[0].type).toBe("prep");
    expect(job.tasks[1].completedAt).not.toBeNull();
  });

  it("stores and retrieves interviews[]", async () => {
    const job = await prisma.job.create({
      data: makeJob({
        interviews: {
          set: [
            {
              id: crypto.randomUUID(),
              type: "technical",
              scheduledAt: new Date("2026-04-20T14:00:00Z"),
              completedAt: new Date("2026-04-20T15:00:00Z"),
              outcome: "pass",
              notes: "Solved two algorithm problems.",
              createdAt: new Date(),
            },
          ],
        },
      }),
    });

    expect(job.interviews).toHaveLength(1);
    expect(job.interviews[0].type).toBe("technical");
    expect(job.interviews[0].outcome).toBe("pass");
  });

  it("stores and retrieves tracerLinks[]", async () => {
    const token = crypto.randomUUID().replace(/-/g, "");
    const job = await prisma.job.create({
      data: makeJob({
        tracerLinksEnabled: true,
        tracerLinks: {
          set: [
            {
              id: crypto.randomUUID(),
              token,
              label: "Resume PDF link",
              clickCount: 3,
              lastClickAt: new Date(),
              createdAt: new Date(),
            },
          ],
        },
      }),
    });

    expect(job.tracerLinks).toHaveLength(1);
    expect(job.tracerLinks[0].token).toBe(token);
    expect(job.tracerLinks[0].clickCount).toBe(3);
  });

  it("updates embedded arrays by pushing a new item", async () => {
    const job = await prisma.job.create({ data: makeJob() });

    // Add a stage event after creation
    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        stageEvents: {
          push: {
            id: crypto.randomUUID(),
            stage: "applied",
            timestamp: new Date(),
            note: "Pushed after creation",
          },
        },
      },
    });

    expect(updated.stageEvents).toHaveLength(1);
    expect(updated.stageEvents[0].note).toBe("Pushed after creation");
  });
});

// ─── TracerClickEvent Collection ──────────────────────────────────────────────

describe("TracerClickEvent collection", () => {
  it("creates click events linked to a job", async () => {
    const job = await prisma.job.create({ data: makeJob() });

    const click = await prisma.tracerClickEvent.create({
      data: {
        jobId: job.id,
        linkToken: "abc123",
        ip: "1.2.3.4",
        userAgent: "Mozilla/5.0",
        referrer: "https://example.com",
      },
    });

    expect(click.id).toBeTruthy();
    expect(click.jobId).toBe(job.id);
    expect(click.linkToken).toBe("abc123");
  });

  it("queries click events by jobId", async () => {
    const job = await prisma.job.create({ data: makeJob() });

    await prisma.tracerClickEvent.createMany({
      data: [
        { jobId: job.id, linkToken: "tok1" },
        { jobId: job.id, linkToken: "tok2" },
      ],
    });

    const events = await prisma.tracerClickEvent.findMany({
      where: { jobId: job.id },
    });
    expect(events).toHaveLength(2);
  });

  it("queries click events by linkToken", async () => {
    const job = await prisma.job.create({ data: makeJob() });
    await prisma.tracerClickEvent.createMany({
      data: [
        { jobId: job.id, linkToken: "unique-tok" },
        { jobId: job.id, linkToken: "other-tok" },
      ],
    });

    const events = await prisma.tracerClickEvent.findMany({
      where: { linkToken: "unique-tok" },
    });
    expect(events).toHaveLength(1);
  });
});

// ─── PipelineRun Collection ───────────────────────────────────────────────────

describe("PipelineRun collection", () => {
  it("creates and retrieves a pipeline run", async () => {
    const run = await prisma.pipelineRun.create({
      data: {
        status: "running",
        triggeredBy: "manual",
        jobsFound: 0,
        jobsScored: 0,
        jobsSkipped: 0,
      },
    });

    expect(run.id).toBeTruthy();
    expect(run.status).toBe("running");
    expect(run.completedAt).toBeNull();
  });

  it("updates a pipeline run to completed", async () => {
    const run = await prisma.pipelineRun.create({
      data: { status: "running", triggeredBy: "scheduler" },
    });

    const completed = await prisma.pipelineRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        jobsFound: 25,
        jobsScored: 20,
        jobsSkipped: 5,
      },
    });

    expect(completed.status).toBe("completed");
    expect(completed.jobsFound).toBe(25);
    expect(completed.completedAt).not.toBeNull();
  });

  it("lists runs ordered by startedAt descending", async () => {
    await prisma.pipelineRun.create({ data: { status: "completed", triggeredBy: "manual" } });
    await new Promise((r) => setTimeout(r, 10)); // ensure different timestamps
    await prisma.pipelineRun.create({ data: { status: "running", triggeredBy: "scheduler" } });

    const runs = await prisma.pipelineRun.findMany({
      orderBy: { startedAt: "desc" },
    });

    expect(runs[0].status).toBe("running"); // most recent first
    expect(runs[1].status).toBe("completed");
  });
});

// ─── ChatThread + Embedded Messages ──────────────────────────────────────────

describe("ChatThread collection", () => {
  it("creates a thread with embedded messages", async () => {
    const job = await prisma.job.create({ data: makeJob() });

    const thread = await prisma.chatThread.create({
      data: {
        jobId: job.id,
        messages: {
          set: [
            { id: crypto.randomUUID(), role: "user", content: "What does this role require?", createdAt: new Date() },
            { id: crypto.randomUUID(), role: "assistant", content: "The role requires TypeScript...", createdAt: new Date() },
          ],
        },
      },
    });

    expect(thread.jobId).toBe(job.id);
    expect(thread.messages).toHaveLength(2);
    expect(thread.messages[0].role).toBe("user");
    expect(thread.messages[1].role).toBe("assistant");
  });

  it("appends a message to an existing thread", async () => {
    const job = await prisma.job.create({ data: makeJob() });
    const thread = await prisma.chatThread.create({
      data: { jobId: job.id, messages: { set: [] } },
    });

    const updated = await prisma.chatThread.update({
      where: { id: thread.id },
      data: {
        messages: {
          push: { id: crypto.randomUUID(), role: "user", content: "Follow-up question", createdAt: new Date() },
        },
      },
    });

    expect(updated.messages).toHaveLength(1);
  });

  it("retrieves threads by jobId", async () => {
    const job = await prisma.job.create({ data: makeJob() });
    await prisma.chatThread.createMany({
      data: [{ jobId: job.id }, { jobId: job.id }],
    });

    const threads = await prisma.chatThread.findMany({ where: { jobId: job.id } });
    expect(threads).toHaveLength(2);
  });
});

// ─── Settings Singleton ───────────────────────────────────────────────────────

describe("Settings singleton", () => {
  const SINGLETON_ID = "singleton";

  it("creates the singleton settings document", async () => {
    const settings = await prisma.settings.create({
      data: { id: SINGLETON_ID, data: { model: "gemini/flash", llmApiKey: "" } },
    });

    expect(settings.id).toBe(SINGLETON_ID);
  });

  it("upserts settings without duplicating", async () => {
    // First upsert — creates
    await prisma.settings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, data: { model: "gemini/flash" } },
      update: { data: { model: "gemini/flash" } },
    });

    // Second upsert — updates
    await prisma.settings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, data: { model: "openai/gpt-4o" } },
      update: { data: { model: "openai/gpt-4o" } },
    });

    const all = await prisma.settings.findMany();
    expect(all).toHaveLength(1);
    expect((all[0].data as Record<string, string>).model).toBe("openai/gpt-4o");
  });

  it("reads settings via findFirst", async () => {
    await prisma.settings.create({
      data: { id: SINGLETON_ID, data: { rxresumeUrl: "https://v4.rxresu.me" } },
    });

    const settings = await prisma.settings.findFirst();
    expect(settings).not.toBeNull();
    expect((settings!.data as Record<string, string>).rxresumeUrl).toBe("https://v4.rxresu.me");
  });
});

// ─── PostApplicationIntegration + Embedded SyncRuns ─────────────────────────

describe("PostApplicationIntegration collection", () => {
  it("creates an integration with embedded syncRuns", async () => {
    const integration = await prisma.postApplicationIntegration.create({
      data: {
        provider: "gmail",
        status: "connected",
        email: "user@example.com",
        syncRuns: {
          set: [
            {
              id: crypto.randomUUID(),
              status: "completed",
              messagesFound: 12,
              startedAt: new Date(),
              completedAt: new Date(),
              error: null,
            },
          ],
        },
      },
    });

    expect(integration.provider).toBe("gmail");
    expect(integration.syncRuns).toHaveLength(1);
    expect(integration.syncRuns[0].messagesFound).toBe(12);
  });

  it("appends a new sync run", async () => {
    const integration = await prisma.postApplicationIntegration.create({
      data: { provider: "gmail", status: "connected", syncRuns: { set: [] } },
    });

    const updated = await prisma.postApplicationIntegration.update({
      where: { id: integration.id },
      data: {
        syncRuns: {
          push: {
            id: crypto.randomUUID(),
            status: "failed",
            messagesFound: 0,
            startedAt: new Date(),
            error: "OAuth token expired",
          },
        },
      },
    });

    expect(updated.syncRuns).toHaveLength(1);
    expect(updated.syncRuns[0].status).toBe("failed");
    expect(updated.syncRuns[0].error).toBe("OAuth token expired");
  });
});

// ─── PostApplicationMessage Collection ───────────────────────────────────────

describe("PostApplicationMessage collection", () => {
  it("creates messages linked to an integration", async () => {
    const integration = await prisma.postApplicationIntegration.create({
      data: { provider: "gmail", status: "connected" },
    });

    const message = await prisma.postApplicationMessage.create({
      data: {
        integrationId: integration.id,
        externalId: "gmail-msg-001",
        subject: "Interview invitation — Senior TypeScript Engineer",
        fromAddress: "recruiter@acme.com",
        classification: "interview_invite",
        relevance: "high",
        rawSnippet: "We'd like to invite you for an interview...",
      },
    });

    expect(message.integrationId).toBe(integration.id);
    expect(message.classification).toBe("interview_invite");
    expect(message.externalId).toBe("gmail-msg-001");
  });

  it("queries unreviewed messages", async () => {
    const integration = await prisma.postApplicationIntegration.create({
      data: { provider: "gmail", status: "connected" },
    });

    await prisma.postApplicationMessage.createMany({
      data: [
        { integrationId: integration.id, externalId: "msg-1", classification: "interview_invite", approved: null },
        { integrationId: integration.id, externalId: "msg-2", classification: "rejection", approved: true },
        { integrationId: integration.id, externalId: "msg-3", classification: "offer", approved: null },
      ],
    });

    const pending = await prisma.postApplicationMessage.findMany({
      where: { integrationId: integration.id, approved: null },
    });

    expect(pending).toHaveLength(2);
  });

  it("links a message to a job after approval", async () => {
    const job = await prisma.job.create({ data: makeJob() });
    const integration = await prisma.postApplicationIntegration.create({
      data: { provider: "gmail", status: "connected" },
    });
    const message = await prisma.postApplicationMessage.create({
      data: { integrationId: integration.id, externalId: "msg-review" },
    });

    const reviewed = await prisma.postApplicationMessage.update({
      where: { id: message.id },
      data: { linkedJobId: job.id, approved: true, reviewedAt: new Date() },
    });

    expect(reviewed.linkedJobId).toBe(job.id);
    expect(reviewed.approved).toBe(true);
  });
});

// ─── Cross-Collection Queries ─────────────────────────────────────────────────

describe("Cross-collection queries", () => {
  it("counts jobs by status", async () => {
    await prisma.job.createMany({
      data: [
        makeJob({ status: "ready" }),
        makeJob({ status: "ready" }),
        makeJob({ status: "applied" }),
        makeJob({ status: "discovered" }),
      ],
    });

    const readyCount = await prisma.job.count({ where: { status: "ready" } });
    const appliedCount = await prisma.job.count({ where: { status: "applied" } });

    expect(readyCount).toBe(2);
    expect(appliedCount).toBe(1);
  });

  it("paginates job results", async () => {
    await prisma.job.createMany({
      data: Array.from({ length: 15 }, (_, i) => makeJob({ title: `Job ${i}` })),
    });

    const page1 = await prisma.job.findMany({ skip: 0, take: 10, orderBy: { createdAt: "asc" } });
    const page2 = await prisma.job.findMany({ skip: 10, take: 10, orderBy: { createdAt: "asc" } });

    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(5);
  });
});
