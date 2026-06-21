import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../init.js";

export const pipelineRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.pipelineRun.findMany({
        orderBy: { startedAt: "desc" },
        take: input.limit,
      });
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.prisma.pipelineRun.findUnique({ where: { id: input.id } });
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline run not found" });
      return run;
    }),

  trigger: publicProcedure
    .input(
      z.object({
        triggeredBy: z.enum(["manual", "scheduler", "webhook"]).default("manual"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.pipelineRun.create({
        data: {
          status: "running",
          triggeredBy: input.triggeredBy,
        },
      });
    }),
});
