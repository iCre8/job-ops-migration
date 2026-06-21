import { exec } from "node:child_process";
import { promisify } from "node:util";
import { eq, and } from "drizzle-orm";
import { db, schema, closeDb } from "./db";

const execAsync = promisify(exec);

export interface VerificationResult {
  verdict:
    | "likely_real"
    | "needs_verification"
    | "possible_ghost"
    | "likely_scam"
    | "insufficient_evidence";
  confidenceScore: number;
  applyPriority: "high" | "medium" | "low" | "do_not_apply";
  evidence: string[];
  redFlags: string[];
  missingEvidence: string[];
  recommendedNextStep: string;
  outreachMessage: string | null;
}

/**
 * Utility to extract and parse the JSON block out of the agent's output.
 */
export function parseVerificationOutput(output: string): VerificationResult {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = output.match(jsonRegex);

  if (!match || !match[1]) {
    throw new Error("No structured JSON block found in agent response.");
  }

  const parsed = JSON.parse(match[1].trim());

  // Validate fields
  if (typeof parsed.verdict !== "string") {
    throw new Error("Missing required field 'verdict' in agent response.");
  }
  if (typeof parsed.confidenceScore !== "number") {
    throw new Error(
      "Missing or invalid field 'confidenceScore' in agent response.",
    );
  }
  if (typeof parsed.applyPriority !== "string") {
    throw new Error("Missing required field 'applyPriority' in agent response.");
  }

  return {
    verdict: parsed.verdict,
    confidenceScore: parsed.confidenceScore,
    applyPriority: parsed.applyPriority,
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
    missingEvidence: Array.isArray(parsed.missingEvidence)
      ? parsed.missingEvidence
      : [],
    recommendedNextStep: parsed.recommendedNextStep || "No recommendation.",
    outreachMessage: parsed.outreachMessage || null,
  };
}

/**
 * Executes the local hermes agent CLI with the job verification skill.
 */
export async function runHermesAgent(job: {
  title: string;
  employer: string;
  jobUrl: string;
  jobDescription: string | null;
}): Promise<VerificationResult> {
  const promptParts = [
    `Use the Job Verification Skill.`,
    `Verify this job posting:`,
    `Company: ${job.employer}`,
    `Title: ${job.title}`,
    `URL: ${job.jobUrl}`,
  ];

  if (job.jobDescription) {
    // Limit description size to prevent exceeding context unnecessarily
    const descExcerpt = job.jobDescription.slice(0, 1500);
    promptParts.push(`Description excerpt:\n${descExcerpt}`);
  }

  const prompt = promptParts.join("\n").replace(/"/g, '\\"').replace(/`/g, "\\`").replace(/\$/g, "\\$");

  // Spawn Hermes CLI with safety timeout
  const cmd = `hermes run --skill job-verification --prompt "${prompt}"`;
  console.log(`[Hermes Worker] Spawning command: ${cmd}`);

  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 300000 }); // 5 minutes timeout
    if (stderr && stderr.includes("Error")) {
      console.warn(`[Hermes Worker] Warning/Error from CLI stderr:\n${stderr}`);
    }
    return parseVerificationOutput(stdout);
  } catch (error: any) {
    console.error(`[Hermes Worker] Failed executing hermes CLI:`, error);
    throw error;
  }
}

/**
 * Processes a single job task from the database.
 */
export async function processJobVerification(jobId: string): Promise<boolean> {
  console.log(`[Hermes Worker] Fetching job ${jobId}...`);
  const [job] = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.id as any, jobId))
    .limit(1);

  if (!job) {
    console.error(`[Hermes Worker] Job ${jobId} not found in database.`);
    return false;
  }

  // Mark status as verifying
  console.log(`[Hermes Worker] Marking job ${jobId} as verifying...`);
  await db
    .update(schema.jobs)
    .set({
      verificationStatus: "verifying",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.jobs.id as any, jobId));

  try {
    // Run evaluation
    const result = await runHermesAgent({
      title: job.title,
      employer: job.employer,
      jobUrl: job.jobUrl,
      jobDescription: job.jobDescription,
    });

    console.log(
      `[Hermes Worker] Job ${jobId} verification complete. Verdict: ${result.verdict}, Score: ${result.confidenceScore}`,
    );

    // Save evaluation to db
    await db
      .update(schema.jobs)
      .set({
        verificationStatus: "completed",
        verificationVerdict: result.verdict,
        verificationScore: result.confidenceScore,
        verificationPriority: result.applyPriority,
        verificationDetails: {
          evidence: result.evidence,
          redFlags: result.redFlags,
          missingEvidence: result.missingEvidence,
          recommendedNextStep: result.recommendedNextStep,
        },
        verificationOutreachMessage: result.outreachMessage,
        verificationRunAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.jobs.id as any, jobId));

    return true;
  } catch (err: any) {
    console.error(`[Hermes Worker] Error during job ${jobId} verification:`, err);

    // Update status to failed
    await db
      .update(schema.jobs)
      .set({
        verificationStatus: "failed",
        verificationVerdict: "insufficient_evidence",
        verificationScore: 0,
        verificationPriority: "low",
        verificationDetails: {
          evidence: [],
          redFlags: [`Verification process failed: ${err.message || err}`],
          missingEvidence: [],
          recommendedNextStep: "Try re-running verification manually later.",
        },
        verificationOutreachMessage: null,
        verificationRunAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.jobs.id as any, jobId));

    return false;
  }
}

/**
 * Polls the database continuously for unverified jobs.
 */
export async function startWorker() {
  console.log("[Hermes Worker] Starting continuous polling loop...");
  const sleepMs = 15000; // 15 seconds poll interval

  while (true) {
    try {
      // Find one job that is unverified
      const [pendingJob] = await db
        .select({ id: schema.jobs.id })
        .from(schema.jobs)
        .where(eq(schema.jobs.verificationStatus as any, "unverified"))
        .limit(1);

      if (pendingJob) {
        console.log(`[Hermes Worker] Found pending job: ${pendingJob.id}`);
        await processJobVerification(pendingJob.id);
      } else {
        // No pending jobs, wait
        await new Promise((resolve) => setTimeout(resolve, sleepMs));
      }
    } catch (err) {
      console.error("[Hermes Worker] Unhandled error in worker loop:", err);
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }
}

// Self-execute if run directly
if (process.argv[1]?.endsWith("worker.ts") || process.argv[1]?.endsWith("worker.js")) {
  if (process.env.SINGLE_RUN === "true") {
    // Run once and exit
    const runOnce = async () => {
      const [pendingJob] = await db
        .select({ id: schema.jobs.id })
        .from(schema.jobs)
        .where(eq(schema.jobs.verificationStatus as any, "unverified"))
        .limit(1);

      if (pendingJob) {
        await processJobVerification(pendingJob.id);
      } else {
        console.log("[Hermes Worker] No pending jobs to verify.");
      }
      await closeDb();
      process.exit(0);
    };
    runOnce().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else {
    // Continuous polling
    startWorker().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
}
