import { randomUUID } from "node:crypto";
import { hashPassword } from "../auth/password";
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_NAME } from "../tenancy/constants";
import { db, closeDb, schema } from "./index";
import { eq } from "drizzle-orm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isTest = process.env.NODE_ENV === "test" || typeof globalThis.vitest !== "undefined" || process.env.VITEST;

async function main() {
  console.log("Running migrations...");
  if (isTest) {
    const { migrate: migratePglite } = await import("drizzle-orm/pglite/migrator");
    await migratePglite(db, {
      migrationsFolder: path.join(__dirname, "migrations"),
    });
  } else {
    const { migrate: migratePostgres } = await import("drizzle-orm/postgres-js/migrator");
    await migratePostgres(db, {
      migrationsFolder: path.join(__dirname, "migrations"),
    });
  }
  console.log("Migrations completed successfully!");

  // Seed default tenant
  const tenantRows = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, DEFAULT_TENANT_ID))
    .limit(1);

  if (tenantRows.length === 0) {
    console.log("Seeding default tenant...");
    await db.insert(schema.tenants).values({
      id: DEFAULT_TENANT_ID,
      name: DEFAULT_TENANT_NAME,
      slug: "default",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Seed default user if BASIC_AUTH_USER is configured and no users exist
  const existingUsers = await db
    .select()
    .from(schema.users)
    .limit(1);

  if (existingUsers.length === 0) {
    const rawUsername = (process.env.BASIC_AUTH_USER || "").trim();
    const username = rawUsername.toLowerCase();
    const password = (process.env.BASIC_AUTH_PASSWORD || "").trim();
    if (username && password) {
      console.log(`Seeding default user: ${username}...`);
      const userId = randomUUID();
      const membershipId = randomUUID();
      const now = new Date().toISOString();
      const { passwordHash, passwordSalt } = await hashPassword(password);

      await db.insert(schema.users).values({
        id: userId,
        username,
        displayName: rawUsername || username,
        passwordHash,
        passwordSalt,
        isSystemAdmin: true,
        isDisabled: false,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.tenantMemberships).values({
        id: membershipId,
        userId,
        tenantId: DEFAULT_TENANT_ID,
        role: "owner",
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    if (!isTest) {
      process.exit(1);
    } else {
      throw err;
    }
  })
  .finally(async () => {
    if (!isTest) {
      await closeDb();
    }
  });
