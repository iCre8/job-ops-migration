/**
 * tRPC tracking router — Phase 11.
 *
 * Procedures:
 *   status    — load Gmail integration status + recent messages (SSR)
 *   authUrl   — return Google OAuth2 authorization URL
 *   connect   — store OAuth credentials (refreshToken, accessToken, email)
 *   disconnect — clear tokens, set status to "disconnected"
 *   sync      — run email sync for the connected integration
 */

import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { runGmailSync } from "$lib/server/services/gmail/sync.js";
import { publicProcedure, router } from "../init.js";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

// ── helpers ───────────────────────────────────────────────────────────────────

async function findGmailIntegration(prisma: PrismaClient) {
  return prisma.postApplicationIntegration.findFirst({
    where: { provider: "gmail" },
  });
}

// ── router ────────────────────────────────────────────────────────────────────

export const trackingRouter = router({
  /** Integration status and the 20 most-recent classified messages. */
  status: publicProcedure.query(async ({ ctx }) => {
    const integration = await ctx.prisma.postApplicationIntegration.findFirst({
      where: { provider: "gmail" },
    });

    if (!integration) {
      return { status: "not_configured" as const, email: null, messages: [], lastSyncAt: null };
    }

    const messages = await ctx.prisma.postApplicationMessage.findMany({
      where: { integrationId: integration.id },
      orderBy: { receivedAt: "desc" },
      take: 20,
      select: {
        id: true,
        subject: true,
        fromAddress: true,
        receivedAt: true,
        classification: true,
        relevance: true,
        rawSnippet: true,
      },
    });

    const lastSync = integration.syncRuns.at(-1) ?? null;
    return {
      status: integration.status as "connected" | "connecting" | "disconnected",
      email: integration.email,
      messages,
      lastSyncAt: lastSync?.completedAt ?? null,
    };
  }),

  /**
   * Return the Google OAuth2 authorization URL.
   * Returns null when GMAIL_OAUTH_CLIENT_ID is not set (OAuth not configured).
   */
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

  /** Store Gmail OAuth credentials returned from the OAuth callback. */
  connect: publicProcedure
    .input(
      z.object({
        refreshToken: z.string().min(1),
        accessToken: z.string().optional(),
        email: z.string().email().optional(),
        tokenExpiryMs: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await findGmailIntegration(ctx.prisma);

      const data = {
        provider: "gmail",
        status: "connected",
        email: input.email ?? null,
        refreshToken: input.refreshToken,
        accessToken: input.accessToken ?? null,
        tokenExpiry: input.tokenExpiryMs ? new Date(input.tokenExpiryMs) : null,
      };

      if (existing) {
        await ctx.prisma.postApplicationIntegration.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await ctx.prisma.postApplicationIntegration.create({ data: { ...data, syncRuns: [] } });
      }

      return { ok: true };
    }),

  /** Clear tokens and set status to "disconnected". */
  disconnect: publicProcedure.mutation(async ({ ctx }) => {
    const integration = await findGmailIntegration(ctx.prisma);
    if (!integration) throw new TRPCError({ code: "NOT_FOUND", message: "No Gmail integration found" });

    await ctx.prisma.postApplicationIntegration.update({
      where: { id: integration.id },
      data: {
        status: "disconnected",
        refreshToken: null,
        accessToken: null,
        tokenExpiry: null,
      },
    });

    return { ok: true };
  }),

  /** Trigger an email sync for the connected Gmail integration. */
  sync: publicProcedure.mutation(async ({ ctx }) => {
    const integration = await findGmailIntegration(ctx.prisma);
    if (!integration) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No Gmail integration found. Connect Gmail first." });
    }
    if (integration.status !== "connected") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Gmail integration is not connected." });
    }

    try {
      const summary = await runGmailSync(integration.id, ctx.prisma);
      return { ok: true, ...summary };
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : "Gmail sync failed",
      });
    }
  }),
});
