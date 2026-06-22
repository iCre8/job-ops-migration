import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { cancelPipeline, runPipelineOrchestrator } from "$lib/server/pipeline/orchestrator.js";
import { protectedProcedure, publicProcedure, router } from "../init.js";

export const pipelineRouter = router({
  /** Returns the currently-running pipeline run, or null if idle. */
  currentRun: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.pipelineRun.findFirst({
      where: { status: "running" },
      orderBy: { startedAt: "desc" },
    });
  }),

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
        searchTerms:         z.array(z.string()).optional(),
        location:            z.string().optional(),
        country:             z.string().optional(),
        isRemote:            z.boolean().optional(),
        resultsWanted:       z.number().int().min(1).max(200).optional(),
        sites:               z.array(z.string()).optional(),
        minSuitabilityScore: z.number().int().min(0).max(100).optional(),
        topN:                z.number().int().min(1).max(50).optional(),
        scoringInstructions: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Guard: only one pipeline run at a time
      const running = await ctx.prisma.pipelineRun.findFirst({ where: { status: "running" } });
      if (running) {
        throw new TRPCError({ code: "CONFLICT", message: "A pipeline run is already in progress." });
      }

      const run = await ctx.prisma.pipelineRun.create({
        data: { status: "running", triggeredBy: input.triggeredBy },
      });

      // Fire-and-forget — response returns immediately while pipeline runs in background
      const { triggeredBy: _t, ...pipelineConfig } = input;
      runPipelineOrchestrator({ runId: run.id, ...pipelineConfig }).catch((err) => {
        console.error("[pipeline] orchestrator error:", err);
      });

      return run;
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.prisma.pipelineRun.findUnique({ where: { id: input.id } });
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline run not found" });
      if (run.status !== "running") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Run is not in progress" });
      }
      // Signal the in-process orchestrator to stop. If the server restarted since
      // the run began, cancelPipeline returns false (no in-memory entry) but we
      // still update the DB so the UI reflects the cancellation.
      cancelPipeline(input.id);
      return ctx.prisma.pipelineRun.update({
        where: { id: input.id },
        data: { status: "cancelled", error: "Cancelled by user", completedAt: new Date() },
      });
    }),

  searchPresets: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return ctx.prisma.searchPreset.findMany({ orderBy: { lastUsedAt: "desc" } });
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          searchTerms: z.array(z.string()).min(1),
          location: z.string().optional(),
          country: z.string().optional(),
          isRemote: z.boolean().default(false),
          sources: z.array(z.string()).default([]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.searchPreset.create({ data: input });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().min(1).max(100).optional(),
          searchTerms: z.array(z.string()).optional(),
          location: z.string().optional(),
          country: z.string().optional(),
          isRemote: z.boolean().optional(),
          sources: z.array(z.string()).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const preset = await ctx.prisma.searchPreset.findUnique({ where: { id } });
        if (!preset) throw new TRPCError({ code: "NOT_FOUND", message: "Preset not found" });
        return ctx.prisma.searchPreset.update({ where: { id }, data });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const preset = await ctx.prisma.searchPreset.findUnique({ where: { id: input.id } });
        if (!preset) throw new TRPCError({ code: "NOT_FOUND", message: "Preset not found" });
        await ctx.prisma.searchPreset.delete({ where: { id: input.id } });
        return { ok: true };
      }),

    markUsed: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.searchPreset.update({
          where: { id: input.id },
          data: { lastUsedAt: new Date() },
        });
      }),
  }),
});
