import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../init.js";

const DecisionFilter = z.enum(["all", "unseen", "imported", "ignored"]);

export const watchlistRouter = router({
  sources: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return ctx.prisma.watchlistSource.findMany({ orderBy: { label: "asc" } });
    }),

    upsert: protectedProcedure
      .input(
        z.object({
          sourceId: z.string().min(1),
          label: z.string().min(1),
          enabled: z.boolean().default(true),
          config: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const config = (input.config ?? null) as Prisma.InputJsonObject | null;
        return ctx.prisma.watchlistSource.upsert({
          where: { sourceId: input.sourceId },
          create: { sourceId: input.sourceId, label: input.label, enabled: input.enabled, config },
          update: { label: input.label, enabled: input.enabled, config },
        });
      }),

    toggle: protectedProcedure
      .input(z.object({ sourceId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const source = await ctx.prisma.watchlistSource.findUnique({
          where: { sourceId: input.sourceId },
        });
        if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Source not found" });
        return ctx.prisma.watchlistSource.update({
          where: { sourceId: input.sourceId },
          data: { enabled: !source.enabled },
        });
      }),

    delete: protectedProcedure
      .input(z.object({ sourceId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.prisma.watchlistSource.delete({ where: { sourceId: input.sourceId } });
        return { ok: true };
      }),
  }),

  results: router({
    list: protectedProcedure
      .input(
        z.object({
          decision: DecisionFilter.default("unseen"),
          sourceId: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const where: Prisma.WatchlistJobWhereInput = {};
        if (input.decision !== "all") {
          where.decision = input.decision === "unseen" ? null : input.decision;
        }
        if (input.sourceId) where.sourceId = input.sourceId;
        const items = await ctx.prisma.watchlistJob.findMany({
          where,
          orderBy: { seenAt: "desc" },
          take: input.limit,
          ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        });
        return {
          items,
          nextCursor: items.length === input.limit ? items[items.length - 1].id : null,
        };
      }),

    decide: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          decision: z.enum(["imported", "ignored"]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.watchlistJob.update({
          where: { id: input.id },
          data: { decision: input.decision, decidedAt: new Date() },
        });
      }),
  }),
});
