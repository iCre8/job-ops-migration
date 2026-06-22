import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { runGmailSync } from "$lib/server/services/gmail/sync.js";
import { publicProcedure, protectedProcedure, router } from "../init.js";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

async function findGmailIntegration(prisma: PrismaClient) {
  return prisma.postApplicationIntegration.findFirst({ where: { provider: "gmail" } });
}

export const trackingRouter = router({
  status: publicProcedure.query(async ({ ctx }) => {
    const integration = await ctx.prisma.postApplicationIntegration.findFirst({
      where: { provider: "gmail" },
    });
    if (!integration) {
      return { status: "not_configured" as const, email: null, messages: [], lastSyncAt: null, pendingCount: 0 };
    }
    const [messages, pendingCount] = await Promise.all([
      ctx.prisma.postApplicationMessage.findMany({
        where: { integrationId: integration.id },
        orderBy: { receivedAt: "desc" },
        take: 20,
        select: {
          id: true, subject: true, fromAddress: true, receivedAt: true,
          classification: true, relevance: true, rawSnippet: true,
          approved: true, linkedJobId: true, reviewedAt: true,
        },
      }),
      ctx.prisma.postApplicationMessage.count({
        where: { integrationId: integration.id, approved: null },
      }),
    ]);
    const lastSync = integration.syncRuns.at(-1) ?? null;
    return {
      status: integration.status as "connected" | "connecting" | "disconnected",
      email: integration.email,
      messages,
      lastSyncAt: lastSync?.completedAt ?? null,
      pendingCount,
    };
  }),

  authUrl: publicProcedure.query(() => {
    const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
    const redirectUri = process.env.GMAIL_OAUTH_REDIRECT_URI ?? "http://localhost:3000/oauth/gmail/callback";
    if (!clientId) return { url: null };
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GMAIL_SCOPE,
      access_type: "offline",
      prompt: "consent",
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  }),

  connect: publicProcedure
    .input(z.object({
      refreshToken: z.string().min(1),
      accessToken: z.string().optional(),
      email: z.string().email().optional(),
      tokenExpiryMs: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await findGmailIntegration(ctx.prisma);
      const data = {
        provider: "gmail", status: "connected",
        email: input.email ?? null,
        refreshToken: input.refreshToken,
        accessToken: input.accessToken ?? null,
        tokenExpiry: input.tokenExpiryMs ? new Date(input.tokenExpiryMs) : null,
      };
      if (existing) {
        await ctx.prisma.postApplicationIntegration.update({ where: { id: existing.id }, data });
      } else {
        await ctx.prisma.postApplicationIntegration.create({ data: { ...data, syncRuns: [] } });
      }
      return { ok: true };
    }),

  disconnect: publicProcedure.mutation(async ({ ctx }) => {
    const integration = await findGmailIntegration(ctx.prisma);
    if (!integration) throw new TRPCError({ code: "NOT_FOUND", message: "No Gmail integration found" });
    await ctx.prisma.postApplicationIntegration.update({
      where: { id: integration.id },
      data: { status: "disconnected", refreshToken: null, accessToken: null, tokenExpiry: null },
    });
    return { ok: true };
  }),

  sync: publicProcedure.mutation(async ({ ctx }) => {
    const integration = await findGmailIntegration(ctx.prisma);
    if (!integration) throw new TRPCError({ code: "NOT_FOUND", message: "No Gmail integration found. Connect Gmail first." });
    if (integration.status !== "connected") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Gmail integration is not connected." });
    try {
      const summary = await runGmailSync(integration.id, ctx.prisma);
      return { ok: true, ...summary };
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err instanceof Error ? err.message : "Gmail sync failed" });
    }
  }),

  // ── Inbox ─────────────────────────────────────────────────────────────────────

  inbox: router({
    list: protectedProcedure
      .input(z.object({
        filter: z.enum(["pending", "approved", "denied", "all"]).default("pending"),
        limit: z.number().int().min(1).max(200).default(50),
      }))
      .query(async ({ ctx, input }) => {
        const integration = await findGmailIntegration(ctx.prisma);
        if (!integration) return { messages: [], total: 0 };
        const where: Record<string, unknown> = { integrationId: integration.id };
        if (input.filter === "pending") where.approved = null;
        else if (input.filter === "approved") where.approved = true;
        else if (input.filter === "denied") where.approved = false;
        const [messages, total] = await Promise.all([
          ctx.prisma.postApplicationMessage.findMany({
            where,
            orderBy: { receivedAt: "desc" },
            take: input.limit,
          }),
          ctx.prisma.postApplicationMessage.count({ where }),
        ]);
        return { messages, total };
      }),

    approve: protectedProcedure
      .input(z.object({
        messageId: z.string(),
        jobId: z.string().optional(),
        stageTarget: z.string().optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const msg = await ctx.prisma.postApplicationMessage.findUnique({ where: { id: input.messageId } });
        if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
        await ctx.prisma.postApplicationMessage.update({
          where: { id: input.messageId },
          data: { approved: true, linkedJobId: input.jobId ?? null, reviewedAt: new Date() },
        });
        // If a job and stage are specified, advance the job stage
        if (input.jobId && input.stageTarget) {
          const { randomUUID } = await import("node:crypto");
          const stageEvent = { id: randomUUID(), stage: input.stageTarget, timestamp: new Date(), note: input.note ?? null };
          await ctx.prisma.job.update({
            where: { id: input.jobId },
            data: { applicationStage: input.stageTarget, stageEvents: { push: stageEvent } },
          });
        }
        return { ok: true };
      }),

    deny: protectedProcedure
      .input(z.object({ messageId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const msg = await ctx.prisma.postApplicationMessage.findUnique({ where: { id: input.messageId } });
        if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
        await ctx.prisma.postApplicationMessage.update({
          where: { id: input.messageId },
          data: { approved: false, reviewedAt: new Date() },
        });
        return { ok: true };
      }),

    bulkApprove: protectedProcedure
      .input(z.object({ messageIds: z.array(z.string()).min(1) }))
      .mutation(async ({ ctx, input }) => {
        await ctx.prisma.postApplicationMessage.updateMany({
          where: { id: { in: input.messageIds } },
          data: { approved: true, reviewedAt: new Date() },
        });
        return { ok: true, count: input.messageIds.length };
      }),

    bulkDeny: protectedProcedure
      .input(z.object({ messageIds: z.array(z.string()).min(1) }))
      .mutation(async ({ ctx, input }) => {
        await ctx.prisma.postApplicationMessage.updateMany({
          where: { id: { in: input.messageIds } },
          data: { approved: false, reviewedAt: new Date() },
        });
        return { ok: true, count: input.messageIds.length };
      }),
  }),

  // ── Sync run history ──────────────────────────────────────────────────────────

  syncRuns: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
      .query(async ({ ctx, input }) => {
        const integration = await findGmailIntegration(ctx.prisma);
        if (!integration) return [];
        return integration.syncRuns.slice(-input.limit).reverse();
      }),
  }),
});
