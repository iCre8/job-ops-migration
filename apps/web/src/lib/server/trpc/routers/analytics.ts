import { z } from "zod";
import { publicProcedure, router } from "../init.js";

export const analyticsRouter = router({
  overview: publicProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const [allJobs, recentJobs] = await Promise.all([
        ctx.prisma.job.findMany({
          select: {
            id: true,
            status: true,
            applicationStage: true,
            applicationOutcome: true,
            appliedAt: true,
            crawledAt: true,
            source: true,
            stageEvents: true,
          },
        }),
        ctx.prisma.job.findMany({
          where: { crawledAt: { gte: since } },
          select: {
            id: true,
            status: true,
            appliedAt: true,
            crawledAt: true,
            source: true,
          },
        }),
      ]);

      // Applications per day (last N days)
      const appsPerDay: Record<string, number> = {};
      for (let i = 0; i < input.days; i++) {
        const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
        appsPerDay[d.toISOString().slice(0, 10)] = 0;
      }
      for (const job of allJobs) {
        if (job.appliedAt && job.appliedAt >= since) {
          const key = job.appliedAt.toISOString().slice(0, 10);
          if (key in appsPerDay) appsPerDay[key]++;
        }
      }

      // Status breakdown
      const byStatus: Record<string, number> = {};
      for (const job of allJobs) {
        byStatus[job.status] = (byStatus[job.status] ?? 0) + 1;
      }

      // Stage breakdown (applied jobs)
      const byStage: Record<string, number> = {};
      for (const job of allJobs) {
        if (job.applicationStage) {
          byStage[job.applicationStage] = (byStage[job.applicationStage] ?? 0) + 1;
        }
      }

      // Outcome breakdown
      const byOutcome: Record<string, number> = {};
      for (const job of allJobs) {
        if (job.applicationOutcome) {
          byOutcome[job.applicationOutcome] = (byOutcome[job.applicationOutcome] ?? 0) + 1;
        }
      }

      // Response rate by source (applied jobs that received any stage progression)
      const sourceApplied: Record<string, number> = {};
      const sourceResponded: Record<string, number> = {};
      for (const job of allJobs) {
        if (job.status === "applied" || job.status === "in_progress") {
          sourceApplied[job.source] = (sourceApplied[job.source] ?? 0) + 1;
          const hasResponse = job.stageEvents.some((e) =>
            ["recruiter_screen", "assessment", "hiring_manager_screen",
             "technical_interview", "onsite", "offer"].includes(e.stage),
          );
          if (hasResponse) {
            sourceResponded[job.source] = (sourceResponded[job.source] ?? 0) + 1;
          }
        }
      }
      const responseRateBySource = Object.keys(sourceApplied).map((src) => ({
        source: src,
        applied: sourceApplied[src],
        responded: sourceResponded[src] ?? 0,
        rate:
          sourceApplied[src] > 0
            ? Math.round(((sourceResponded[src] ?? 0) / sourceApplied[src]) * 100)
            : 0,
      }));

      // Conversion: applied → offer
      const appliedCount = allJobs.filter(
        (j) => j.status === "applied" || j.status === "in_progress",
      ).length;
      const offerCount = allJobs.filter(
        (j) => j.applicationStage === "offer" || j.applicationOutcome === "offer_accepted",
      ).length;
      const conversionRate = appliedCount > 0 ? Math.round((offerCount / appliedCount) * 100) : 0;

      // Funnel (cumulative stage depths)
      const STAGE_ORDER = [
        "applied",
        "recruiter_screen",
        "assessment",
        "hiring_manager_screen",
        "technical_interview",
        "onsite",
        "offer",
        "closed",
      ];
      const stageCounts: Record<string, number> = {};
      for (const stage of STAGE_ORDER) stageCounts[stage] = 0;
      for (const job of allJobs) {
        if (job.applicationStage && stageCounts[job.applicationStage] !== undefined) {
          stageCounts[job.applicationStage]++;
        }
      }

      return {
        days: input.days,
        appsPerDay: Object.entries(appsPerDay).map(([date, count]) => ({ date, count })),
        byStatus,
        byStage,
        byOutcome,
        responseRateBySource,
        conversion: { appliedCount, offerCount, rate: conversionRate },
        stageFunnel: STAGE_ORDER.map((stage) => ({ stage, count: stageCounts[stage] })),
        totals: {
          discovered: byStatus["discovered"] ?? 0,
          ready: byStatus["ready"] ?? 0,
          applied: (byStatus["applied"] ?? 0) + (byStatus["in_progress"] ?? 0),
          skipped: byStatus["skipped"] ?? 0,
          total: allJobs.length,
        },
      };
    }),
});
