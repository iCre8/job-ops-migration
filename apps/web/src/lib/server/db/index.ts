import { PrismaClient } from "@prisma/client";

// ─── Singleton Pattern ─────────────────────────────────────────────────────────
// Re-use a single PrismaClient across hot-reloads in development.
//
// Prisma 6 reads DATABASE_URL from the schema datasource in runtime and CLI commands.
//
// Usage:
//   import { getPrisma } from "$lib/server/db/index.js";
//   const prisma = getPrisma();

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
  }
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export function getPrisma(): PrismaClient {
  // Cache on global to survive Vite HMR module re-evaluation in development
  if (!global.__prisma) {
    global.__prisma = createClient();
  }
  return global.__prisma;
}

// ─── Test Helper ──────────────────────────────────────────────────────────────
// For integration tests only — injects a client pointed at an in-memory
// MongoDB instance (mongodb-memory-server) without affecting the singleton.
//
// Usage (in tests):
//   import { createTestClient } from "$lib/server/db/index.js";
//   const prisma = createTestClient(mongod.getUri("dbname"));

export function createTestClient(url: string): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: { url },
    },
    log: ["error"],
  });
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
// Call this in the SvelteKit server hooks or process signal handlers.

export async function disconnectPrisma(): Promise<void> {
  if (global.__prisma) {
    await global.__prisma.$disconnect();
    global.__prisma = undefined;
  }
}
