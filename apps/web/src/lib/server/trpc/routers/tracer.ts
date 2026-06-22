import { z } from "zod";
import { protectedProcedure, router } from "../init.js";

export const tracerRouter = router({
  analytics: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Jobs that have tracer links enabled and have at least one click
      const jobs = await ctx.prisma.job.findMany({
        where: { tracerLinksEnabled: true },
        orderBy: { updatedAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          title: true,
          employer: true,
          status: true,
          tracerLinks: true,
        },
      });

      const clickCounts = await ctx.prisma.tracerClickEvent.groupBy({
        by: ["jobId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      });

      const clicksByJob = new Map(clickCounts.map((c) => [c.jobId, c._count.id]));

      return jobs.map((job) => ({
        ...job,
        totalClicks: clicksByJob.get(job.id) ?? 0,
      }));
    }),

  jobClicks: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.tracerClickEvent.findMany({
        where: { jobId: input.jobId },
        orderBy: { clickedAt: "desc" },
        take: 200,
      });
    }),
});
