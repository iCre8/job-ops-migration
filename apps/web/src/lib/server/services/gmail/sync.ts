/**
 * Gmail sync service — Phase 11.
 *
 * Fetches job-application emails for a connected Gmail integration, classifies
 * them, and persists them as PostApplicationMessage records.
 *
 * Idempotent: messages already stored by externalId are skipped.
 *
 * Each sync run is recorded in PostApplicationIntegration.syncRuns
 * (embedded array) so the tracking page can show history.
 */

import type { PrismaClient } from "@prisma/client";
import { classifyEmail, classifyRelevance } from "./classifier.js";
import {
  buildSearchQuery,
  getMessageMetadata,
  listMessageIds,
  resolveAccessToken,
} from "./api.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SyncSummary = {
  discovered: number;
  stored: number;
  errored: number;
};

// ── runGmailSync ──────────────────────────────────────────────────────────────

/**
 * Sync emails for a PostApplicationIntegration document.
 *
 * @param integrationId — Prisma document `id` for the Gmail integration
 * @param prisma        — Prisma client (injected from tRPC context)
 */
export async function runGmailSync(
  integrationId: string,
  prisma: PrismaClient,
): Promise<SyncSummary> {
  const startedAt = new Date();
  let discovered = 0;
  let stored = 0;
  let errored = 0;

  // 1. Load the integration record
  const integration = await prisma.postApplicationIntegration.findUnique({
    where: { id: integrationId },
  });
  if (!integration) {
    throw new Error(`Gmail integration not found: ${integrationId}`);
  }
  if (!integration.refreshToken) {
    throw new Error("Gmail integration has no refresh token — reconnect required.");
  }

  // 2. Resolve access token (refresh if near-expiry)
  const { accessToken, tokenExpiry } = await resolveAccessToken({
    refreshToken: integration.refreshToken,
    accessToken: integration.accessToken,
    tokenExpiry: integration.tokenExpiry,
  });

  // Persist the refreshed token
  await prisma.postApplicationIntegration.update({
    where: { id: integrationId },
    data: { accessToken, tokenExpiry },
  });

  // 3. List matching message IDs
  const query = buildSearchQuery(90);
  const messageIds = await listMessageIds(accessToken, query, 100);
  discovered = messageIds.length;

  // 4. Process each message
  for (const messageId of messageIds) {
    try {
      // Skip if already stored
      const existing = await prisma.postApplicationMessage.findFirst({
        where: { integrationId, externalId: messageId },
        select: { id: true },
      });
      if (existing) continue;

      // Fetch metadata from Gmail
      const meta = await getMessageMetadata(accessToken, messageId);

      // Classify
      const classification = classifyEmail(meta.subject, meta.snippet);
      const relevance = classifyRelevance(classification);

      // Persist
      await prisma.postApplicationMessage.create({
        data: {
          integrationId,
          externalId: messageId,
          subject: meta.subject,
          fromAddress: meta.from,
          receivedAt: meta.receivedAt,
          classification,
          relevance,
          rawSnippet: meta.snippet.slice(0, 500),
        },
      });
      stored += 1;
    } catch {
      errored += 1;
    }
  }

  // 5. Record sync run (embedded array push)
  await prisma.postApplicationIntegration.update({
    where: { id: integrationId },
    data: {
      syncRuns: {
        push: {
          id: crypto.randomUUID(),
          status: errored > 0 && stored === 0 ? "failed" : "completed",
          messagesFound: discovered,
          startedAt,
          completedAt: new Date(),
          error: errored > 0 ? `${errored} message(s) failed` : null,
        },
      },
    },
  });

  return { discovered, stored, errored };
}
