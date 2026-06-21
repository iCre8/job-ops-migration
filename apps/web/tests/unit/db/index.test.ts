/**
 * Unit tests for src/lib/server/db/index.ts
 *
 * Tests the singleton pattern, error handling, and shutdown without
 * requiring a real MongoDB connection. PrismaClient is mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock PrismaClient ────────────────────────────────────────────────────────

const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const MockPrismaClient = vi.fn().mockImplementation(() => ({
  $disconnect: mockDisconnect,
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: MockPrismaClient,
}));

// ─── Import after mock is set up ──────────────────────────────────────────────

const { getPrisma, disconnectPrisma, createTestClient } = await import(
  "../../../src/lib/server/db/index.js"
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getPrisma singleton", () => {
  beforeEach(() => {
    // Clear global singleton between tests
    global.__prisma = undefined;
    process.env.DATABASE_URL = "mongodb://localhost:27017/test";
    MockPrismaClient.mockClear();
    mockDisconnect.mockClear();
  });

  afterEach(() => {
    global.__prisma = undefined;
  });

  it("creates a PrismaClient when DATABASE_URL is set", () => {
    const client = getPrisma();
    expect(client).toBeDefined();
    expect(MockPrismaClient).toHaveBeenCalledOnce();
  });

  it("returns the same instance on repeated calls (singleton)", () => {
    const first = getPrisma();
    const second = getPrisma();
    expect(first).toBe(second);
    expect(MockPrismaClient).toHaveBeenCalledOnce();
  });

  it("throws when DATABASE_URL is not set", () => {
    delete process.env.DATABASE_URL;
    expect(() => getPrisma()).toThrow("DATABASE_URL environment variable is not set.");
  });

  it("does not throw when DATABASE_URL is set to a non-empty string", () => {
    process.env.DATABASE_URL = "mongodb://localhost:27017/jobops";
    expect(() => getPrisma()).not.toThrow();
  });
});

describe("createTestClient", () => {
  beforeEach(() => {
    MockPrismaClient.mockClear();
  });

  it("creates a PrismaClient with the supplied URL override", () => {
    const client = createTestClient("mongodb://localhost:27017/test_db");
    expect(client).toBeDefined();
    expect(MockPrismaClient).toHaveBeenCalledWith(
      expect.objectContaining({
        datasources: {
          db: { url: "mongodb://localhost:27017/test_db" },
        },
        log: ["error"],
      }),
    );
  });

  it("returns a new instance each call (not a singleton)", () => {
    const a = createTestClient("mongodb://localhost/a");
    const b = createTestClient("mongodb://localhost/b");
    // Both are mocked instances but are distinct calls
    expect(MockPrismaClient).toHaveBeenCalledTimes(2);
    expect(a).not.toBe(b);
  });
});

describe("disconnectPrisma", () => {
  beforeEach(() => {
    global.__prisma = undefined;
    process.env.DATABASE_URL = "mongodb://localhost:27017/test";
    MockPrismaClient.mockClear();
    mockDisconnect.mockClear();
  });

  afterEach(() => {
    global.__prisma = undefined;
  });

  it("calls $disconnect on the active client", async () => {
    getPrisma(); // initialise singleton
    await disconnectPrisma();
    expect(mockDisconnect).toHaveBeenCalledOnce();
  });

  it("clears the global singleton after disconnect", async () => {
    getPrisma();
    expect(global.__prisma).toBeDefined();
    await disconnectPrisma();
    expect(global.__prisma).toBeUndefined();
  });

  it("is a no-op when no client has been initialised", async () => {
    await expect(disconnectPrisma()).resolves.toBeUndefined();
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it("allows a new client to be created after disconnect", async () => {
    getPrisma();
    await disconnectPrisma();
    MockPrismaClient.mockClear();

    const fresh = getPrisma();
    expect(fresh).toBeDefined();
    expect(MockPrismaClient).toHaveBeenCalledOnce();
  });
});
