import { randomUUID } from "node:crypto";
import { db, closeDb, schema } from "../src/server/db/index";

async function seedDemoData() {
  console.log("🌱 Seeding demo data...\n");

  try {
    // Create demo pipeline runs
    const runId = randomUUID();
    await db.insert(schema.pipelineRuns).values({
      id: runId,
      status: "completed",
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      completedAt: new Date(Date.now() - 1800000).toISOString(),
      jobsDiscovered: 42,
      jobsProcessed: 38,
      errorMessage: null,
    });
    console.log(`✅ Created demo pipeline run: ${runId}`);

    // Create demo jobs
    const jobs = [
      {
        id: randomUUID(),
        source: "linkedin",
        title: "Senior Software Engineer",
        employer: "Tech Corp",
        jobUrl: "https://example.com/jobs/1",
        applicationLink: "https://example.com/apply/1",
        location: "San Francisco, CA",
        salary: "$150,000 - $200,000",
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        jobDescription:
          "We are looking for a talented Senior Software Engineer with 5+ years of experience...",
        status: "ready" as const,
        suitabilityScore: 92,
        suitabilityReason: "Excellent match for your React and TypeScript skills",
        tailoredSummary: null,
        tailoredHeadline: null,
        tailoredSkills: null,
        selectedProjectIds: null,
        pdfPath: null,
        discoveredAt: new Date(Date.now() - 3600000).toISOString(),
        appliedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        source: "indeed",
        title: "Full Stack Developer",
        employer: "StartUp Inc",
        jobUrl: "https://example.com/jobs/2",
        applicationLink: "https://example.com/apply/2",
        location: "New York, NY",
        salary: "$120,000 - $160,000",
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        jobDescription:
          "Build scalable web applications with Node.js and React...",
        status: "applied" as const,
        suitabilityScore: 87,
        suitabilityReason: "Great fit for full stack position",
        tailoredSummary: null,
        tailoredHeadline: null,
        tailoredSkills: null,
        selectedProjectIds: null,
        pdfPath: null,
        discoveredAt: new Date(Date.now() - 7200000).toISOString(),
        appliedAt: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        source: "glassdoor",
        title: "DevOps Engineer",
        employer: "Cloud Systems",
        jobUrl: "https://example.com/jobs/3",
        applicationLink: "https://example.com/apply/3",
        location: "Austin, TX",
        salary: "$140,000 - $190,000",
        deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        jobDescription:
          "Manage and optimize cloud infrastructure on AWS and Kubernetes...",
        status: "ready" as const,
        suitabilityScore: 79,
        suitabilityReason: "Good DevOps background match",
        tailoredSummary: null,
        tailoredHeadline: null,
        tailoredSkills: null,
        selectedProjectIds: null,
        pdfPath: null,
        discoveredAt: new Date(Date.now() - 10800000).toISOString(),
        appliedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const insertedJobs = await db
      .insert(schema.jobs)
      .values(jobs)
      .returning();
    console.log(`✅ Created ${insertedJobs.length} demo jobs`);

    // Display summary
    const totalJobs = await db.select().from(schema.jobs);
    const totalRuns = await db.select().from(schema.pipelineRuns);

    console.log("\n📊 Database Summary:");
    console.log(`  Jobs: ${totalJobs.length}`);
    console.log(`  Pipeline Runs: ${totalRuns.length}`);
    console.log("\n✨ Demo data seeding complete!");
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    throw error;
  } finally {
    await closeDb();
  }
}

seedDemoData();
