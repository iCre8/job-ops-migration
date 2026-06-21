import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";

// Mock child_process exec
const mockExec = vi.fn();
vi.mock("node:child_process", () => ({
  exec: (cmd: string, options: any, callback: any) => {
    const cb = typeof options === "function" ? options : callback;
    mockExec(cmd, options, cb);
  },
}));

import { parseVerificationOutput, processJobVerification } from "./worker";
import { db, schema, closeDb } from "./db";

describe("Hermes Worker parseVerificationOutput", () => {
  it("successfully parses valid JSON within markdown block", () => {
    const response = `
Thinking and reasoning details go here...
We found several things.

\`\`\`json
{
  "verdict": "likely_real",
  "confidenceScore": 85,
  "applyPriority": "high",
  "evidence": ["Trusted domain", "Direct careers portal link matched"],
  "redFlags": [],
  "missingEvidence": ["No official salary listed"],
  "recommendedNextStep": "Proceed with application directly on the site.",
  "outreachMessage": "Hello Hiring Team, I noticed your post..."
}
\`\`\`

Hope this helps!
    `;

    const parsed = parseVerificationOutput(response);
    expect(parsed.verdict).toBe("likely_real");
    expect(parsed.confidenceScore).toBe(85);
    expect(parsed.applyPriority).toBe("high");
    expect(parsed.evidence).toContain("Trusted domain");
    expect(parsed.redFlags).toHaveLength(0);
    expect(parsed.outreachMessage).toContain("Hello Hiring Team");
  });

  it("throws error when JSON block is missing", () => {
    const badResponse = `Some plain text without a json block.`;
    expect(() => parseVerificationOutput(badResponse)).toThrow(
      "No structured JSON block found in agent response.",
    );
  });

  it("throws error when required fields are missing", () => {
    const badJson = `
\`\`\`json
{
  "confidenceScore": 50
}
\`\`\`
    `;
    expect(() => parseVerificationOutput(badJson)).toThrow(
      "Missing required field 'verdict' in agent response.",
    );
  });
});

describe("Hermes Worker processJobVerification", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Re-create the jobs table and clear data for fresh test execution in PGlite
    await db.execute(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT DEFAULT 'default',
        user_id TEXT DEFAULT 'default',
        source TEXT NOT NULL,
        source_job_id TEXT,
        job_url_direct TEXT,
        date_posted TEXT,
        title TEXT NOT NULL,
        employer TEXT NOT NULL,
        employer_url TEXT,
        job_url TEXT NOT NULL,
        application_link TEXT,
        disciplines TEXT,
        deadline TEXT,
        salary TEXT,
        location TEXT,
        location_evidence TEXT,
        degree_required TEXT,
        starting TEXT,
        job_description TEXT,
        job_type TEXT,
        salary_source TEXT,
        salary_interval TEXT,
        salary_min_amount NUMERIC,
        salary_max_amount NUMERIC,
        salary_currency TEXT,
        is_remote BOOLEAN,
        job_level TEXT,
        job_function TEXT,
        listing_type TEXT,
        emails TEXT,
        company_industry TEXT,
        company_logo TEXT,
        company_url_direct TEXT,
        company_addresses TEXT,
        company_num_employees TEXT,
        company_revenue TEXT,
        company_description TEXT,
        skills TEXT,
        experience_range TEXT,
        company_rating NUMERIC,
        company_reviews_count INTEGER,
        vacancy_count INTEGER,
        work_from_home_type TEXT,
        status TEXT NOT NULL,
        outcome TEXT,
        closed_at TEXT,
        suitability_score INTEGER,
        suitability_reason TEXT,
        job_brief TEXT,
        tailored_summary TEXT,
        tailored_headline TEXT,
        tailored_skills TEXT,
        selected_project_ids TEXT,
        pdf_path TEXT,
        pdf_source TEXT,
        pdf_regenerating BOOLEAN,
        pdf_fingerprint TEXT,
        pdf_generated_at TEXT,
        tracer_links_enabled BOOLEAN,
        sponsor_match_score INTEGER,
        sponsor_match_names TEXT,
        discovered_at TEXT,
        processed_at TEXT,
        ready_at TEXT,
        applied_at TEXT,
        created_at TEXT,
        updated_at TEXT,
        verification_status TEXT DEFAULT 'unverified',
        verification_verdict TEXT,
        verification_score INTEGER,
        verification_priority TEXT,
        verification_details JSONB,
        verification_outreach_message TEXT,
        verification_run_at TEXT
      );
    `);
    await db.delete(schema.jobs);
  });

  afterAll(async () => {
    await closeDb();
  });

  it("updates job status to verifying and completed with correct details upon success", async () => {
    // Insert a dummy job to be verified
    const jobId = "test-job-id-999";
    await db.insert(schema.jobs).values({
      id: jobId,
      title: "Senior QA Architect",
      employer: "Google Inc",
      jobUrl: "https://google.com/careers/123",
      source: "discovered",
      status: "discovered",
      verificationStatus: "unverified",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
    });

    // Mock successful agent output via exec mock
    mockExec.mockImplementation((cmd, options, cb) => {
      const mockOutput = `
\`\`\`json
{
  "verdict": "likely_real",
  "confidenceScore": 98,
  "applyPriority": "high",
  "evidence": ["Official Google domain verified"],
  "redFlags": [],
  "missingEvidence": [],
  "recommendedNextStep": "Apply immediately",
  "outreachMessage": "Hi, I am interested..."
}
\`\`\`
      `;
      cb(null, { stdout: mockOutput, stderr: "" });
    });

    const success = await processJobVerification(jobId);
    expect(success).toBe(true);

    // Fetch the updated job
    const [updatedJob] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id as any, jobId))
      .limit(1);

    expect(updatedJob).toBeDefined();
    expect(updatedJob.verificationStatus).toBe("completed");
    expect(updatedJob.verificationVerdict).toBe("likely_real");
    expect(updatedJob.verificationScore).toBe(98);
    expect(updatedJob.verificationPriority).toBe("high");
    expect(updatedJob.verificationOutreachMessage).toBe("Hi, I am interested...");
    expect(updatedJob.verificationDetails).toEqual({
      evidence: ["Official Google domain verified"],
      redFlags: [],
      missingEvidence: [],
      recommendedNextStep: "Apply immediately",
    });
  });

  it("sets job verification status to failed if Hermes CLI execution fails", async () => {
    const jobId = "test-job-id-fail";
    await db.insert(schema.jobs).values({
      id: jobId,
      title: "Suspicious Remote Assistant",
      employer: "FakeCorp Inc",
      jobUrl: "https://fakecorp-careers.biz/456",
      source: "discovered",
      status: "discovered",
      verificationStatus: "unverified",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
    });

    // Mock exec failure
    mockExec.mockImplementation((cmd, options, cb) => {
      cb(new Error("Timeout connection closed"), { stdout: "", stderr: "Error occurred" });
    });

    const success = await processJobVerification(jobId);
    expect(success).toBe(false);

    // Fetch updated job
    const [updatedJob] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id as any, jobId))
      .limit(1);

    expect(updatedJob).toBeDefined();
    expect(updatedJob.verificationStatus).toBe("failed");
    expect(updatedJob.verificationScore).toBe(0);
    expect(updatedJob.verificationPriority).toBe("low");
    expect(updatedJob.verificationVerdict).toBe("insufficient_evidence");
    expect(updatedJob.verificationDetails?.redFlags).toContain(
      "Verification process failed: Timeout connection closed",
    );
  });
});
