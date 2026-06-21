import { db, closeDb, schema } from "./index";
import { sql } from "drizzle-orm";

export async function clearDatabase(): Promise<{ jobsDeleted: number; runsDeleted: number }> {
  try {
    await db.delete(schema.stageEvents);
    await db.delete(schema.tasks);
    await db.delete(schema.interviews);
    const jobsResult = await db.delete(schema.jobs).returning();
    const runsResult = await db.delete(schema.pipelineRuns).returning();

    console.log(
      `🗑️ Cleared database: ${jobsResult.length} jobs, ${runsResult.length} pipeline runs`,
    );
    return {
      jobsDeleted: jobsResult.length,
      runsDeleted: runsResult.length,
    };
  } catch (error) {
    console.error("Failed to clear database:", error);
    throw error;
  }
}

export async function dropDatabase(): Promise<void> {
  try {
    const tableNames = Object.keys(schema);
    for (const key of tableNames) {
      const table = (schema as any)[key];
      if (table && typeof table === "object" && "_" in table && "name" in table) {
        await db.execute(sql.raw(`TRUNCATE TABLE "${table.name}" CASCADE`));
      }
    }
    console.log("🗑️ Database tables truncated successfully");
  } catch (error) {
    console.error("Failed to drop database:", error);
  }
}

// CLI execution
if (process.argv[1]?.includes("clear.ts")) {
  const arg = process.argv[2];

  const run = async () => {
    if (arg === "--drop") {
      await dropDatabase();
    } else {
      await clearDatabase();
    }
  };

  run()
    .catch((err) => {
      console.error("DB clear script failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await closeDb();
    });
}
