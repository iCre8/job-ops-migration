import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../../orchestrator/src/server/db/schema";

const isTest =
  process.env.NODE_ENV === "test" ||
  typeof (globalThis as any).vitest !== "undefined" ||
  process.env.VITEST;

export { schema };

export let client: any;
export let db: any;
export let closeDb: () => Promise<void>;

if (isTest) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const localClient = new PGlite();
  client = localClient;
  db = drizzlePglite(localClient, { schema }) as any;
  closeDb = async () => {
    if ((localClient as any)._closed) return;
    (localClient as any)._closed = true;
    await localClient.close();
  };
} else {
  let databaseUrl = process.env.DATABASE_URL;
  if (
    !databaseUrl ||
    (!databaseUrl.startsWith("postgres://") &&
      !databaseUrl.startsWith("postgresql://"))
  ) {
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
    await localClient.end();
  };
}
