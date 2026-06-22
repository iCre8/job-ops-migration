import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../init.js";

export const settingsRouter = router({
  get: publicProcedure.query(async ({ ctx }) => {
    const settings = await ctx.prisma.settings.findFirst({ where: { id: "singleton" } });
    return (settings?.data ?? {}) as Record<string, unknown>;
  }),

  update: publicProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.prisma.settings.findFirst({ where: { id: "singleton" } });
      const merged = {
        ...((current?.data as Record<string, unknown>) ?? {}),
        ...input,
      } as Prisma.InputJsonObject;
      return ctx.prisma.settings.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", data: merged },
        update: { data: merged },
      });
    }),

  // Validate LLM credentials by making a minimal test call
  validateLlm: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["openai", "openrouter", "anthropic", "google", "lm_studio"]),
        apiKey: z.string().optional(),
        endpoint: z.string().url().optional(),
        model: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { provider, apiKey, endpoint, model } = input;
      try {
        if (provider === "openai" || provider === "openrouter") {
          const base = endpoint ?? (provider === "openrouter"
            ? "https://openrouter.ai/api/v1"
            : "https://api.openai.com/v1");
          const res = await fetch(`${base}/models`, {
            headers: { Authorization: `Bearer ${apiKey ?? ""}` },
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return { ok: true };
        }
        if (provider === "anthropic") {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey ?? "",
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: model ?? "claude-haiku-4-5-20251001",
              max_tokens: 1,
              messages: [{ role: "user", content: "ping" }],
            }),
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) {
            const body = await res.text();
            throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
          }
          return { ok: true };
        }
        if (provider === "google") {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey ?? ""}`,
            { signal: AbortSignal.timeout(10_000) },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return { ok: true };
        }
        if (provider === "lm_studio") {
          const base = endpoint ?? "http://localhost:1234/v1";
          const res = await fetch(`${base}/models`, { signal: AbortSignal.timeout(5_000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return { ok: true };
        }
        return { ok: false, error: "Unknown provider" };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Validation failed" };
      }
    }),

  // Validate RxResume connection
  validateRxResume: protectedProcedure
    .input(z.object({ url: z.string().url(), email: z.string().email(), password: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const res = await fetch(`${input.url}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: input.email, password: input.password }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
      }
    }),

  // Backups
  backups: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.isSystemAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      return ctx.prisma.backup.findMany({ orderBy: { createdAt: "desc" } });
    }),

    create: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.isSystemAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      // Gather counts for the backup manifest
      const [jobs, runs, threads] = await Promise.all([
        ctx.prisma.job.count(),
        ctx.prisma.pipelineRun.count(),
        ctx.prisma.chatThread.count(),
      ]);
      const filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      // Record the backup entry (actual dump logic would run here in production)
      return ctx.prisma.backup.create({
        data: { filename, sizeBytes: jobs * 2048 + runs * 512 + threads * 256 },
      });
    }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.isSystemAdmin) throw new TRPCError({ code: "FORBIDDEN" });
        const backup = await ctx.prisma.backup.findUnique({ where: { id: input.id } });
        if (!backup) throw new TRPCError({ code: "NOT_FOUND" });
        await ctx.prisma.backup.delete({ where: { id: input.id } });
        return { ok: true };
      }),
  }),

  // Danger zone
  database: router({
    clearByStatus: protectedProcedure
      .input(z.object({ status: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.isSystemAdmin) throw new TRPCError({ code: "FORBIDDEN" });
        const result = await ctx.prisma.job.deleteMany({ where: { status: input.status } });
        return { deleted: result.count };
      }),

    clearByScore: protectedProcedure
      .input(z.object({ maxScore: z.number().min(0).max(100) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.isSystemAdmin) throw new TRPCError({ code: "FORBIDDEN" });
        const result = await ctx.prisma.job.deleteMany({
          where: { scoreOverall: { lte: input.maxScore } },
        });
        return { deleted: result.count };
      }),

    clearAll: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.isSystemAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      const [jobs, runs] = await Promise.all([
        ctx.prisma.job.deleteMany(),
        ctx.prisma.pipelineRun.deleteMany(),
      ]);
      return { deletedJobs: jobs.count, deletedRuns: runs.count };
    }),
  }),
});
