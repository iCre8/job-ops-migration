/**
 * Database connection and initialization.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const isTest = process.env.NODE_ENV === "test" || typeof (globalThis as any).vitest !== "undefined" || process.env.VITEST;

export { schema };

export let client: any;
export let db: PostgresJsDatabase<typeof schema>;
export let closeDb: () => Promise<void>;

if (isTest) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const path = await import("node:path");
  const dataDir = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, "pgdata") : undefined;
  const localClient = new PGlite(dataDir);
  client = localClient;
  db = drizzlePglite(localClient, { schema }) as any;
  closeDb = async () => {
    if ((localClient as any)._closed) return;
    (localClient as any)._closed = true;
    try {
      await localClient.close();
    } catch (err: any) {
      console.error("Error closing pglite database:", err);
    }
  };
} else {
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://"))) {
    databaseUrl = "postgres://skillflow:skillflow@localhost:5432/jobops";
  }

  const localClient = postgres(databaseUrl, {
    max: 10,
  });
  client = localClient;
  db = drizzle(localClient, { schema });
  
  let isClosed = false;
  closeDb = async () => {
    if (isClosed) return;
    isClosed = true;
    try {
      await localClient.end();
    } catch (err: any) {
      console.error("Error closing pg connection pool:", err);
    }
  };
}

export async function reinitializeTestDb(dataDir: string) {
  if (!isTest) return;
  if (client && !(client as any)._closed) {
    (client as any)._closed = true;
    try {
      await client.close();
    } catch (e) {}
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const path = await import("node:path");
  const localClient = new PGlite(path.join(dataDir, "pgdata"));
  client = localClient;
  db = drizzlePglite(localClient, { schema }) as any;
  closeDb = async () => {
    if ((localClient as any)._closed) return;
    (localClient as any)._closed = true;
    try {
      await localClient.close();
    } catch (err: any) {
      console.error("Error closing pglite database:", err);
    }
  };
}
