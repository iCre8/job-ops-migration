/**
 * Typed Prisma mock for tRPC unit tests.
 *
 * Reset between tests with `vi.clearAllMocks()` (resets call history) or
 * `vi.resetAllMocks()` (also resets return values).
 *
 * Only the methods used by Phase 4 routers are mocked here.
 * Add methods as new routers are introduced in later phases.
 */
import { vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

export const mockPrisma = {
  job: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  settings: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  pipelineRun: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
} as unknown as PrismaClient;
