import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { generateJobPdf } from "$lib/server/services/pdf/index.js";
import { publicProcedure, router } from "../init.js";

export const jobsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        status: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { status, page, pageSize } = input;
      const where = status ? { status } : undefined;
      const [jobs, total] = await Promise.all([
        ctx.prisma.job.findMany({
          where,
          orderBy: { crawledAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            title: true,
            employer: true,
            location: true,
            status: true,
            scoreOverall: true,
            crawledAt: true,
            appliedAt: true,
            source: true,
            isRemote: true,
            salaryMin: true,
            salaryMax: true,
            salaryCurrency: true,
            pdfPublicUrl: true,
            applicationStage: true,
          },
        }),
        ctx.prisma.job.count({ where }),
      ]);
      return { jobs, total, page, pageSize };
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.id } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      return job;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          status: z.string().optional(),
          applicationStage: z.string().optional(),
          applicationNote: z.string().optional(),
          applicationOutcome: z.string().optional(),
          tracerLinksEnabled: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const exists = await ctx.prisma.job.findUnique({ where: { id: input.id } });
      if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      return ctx.prisma.job.update({ where: { id: input.id }, data: input.data });
    }),

  generatePdf: publicProcedure
    .input(
      z.object({
        jobId: z.string(),
        resumeData: z.record(z.string(), z.unknown()),
        title: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });

      try {
        return await generateJobPdf(
          { jobId: input.jobId, resumeData: input.resumeData, title: input.title },
          ctx.prisma,
        );
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "PDF generation failed",
        });
      }
    }),
});
