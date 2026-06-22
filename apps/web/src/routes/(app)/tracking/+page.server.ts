import { trpcServer } from "$lib/server/trpc/server.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  try {
    const trpc = await trpcServer(event);
    const [statusResult, authUrlResult, inboxResult, syncRunsResult] = await Promise.all([
      trpc.tracking.status(),
      trpc.tracking.authUrl(),
      trpc.tracking.inbox.list({ filter: "pending", limit: 50 }).catch(() => ({ messages: [], total: 0 })),
      trpc.tracking.syncRuns.list({ limit: 20 }).catch(() => []),
    ]);
    return {
      tracking: statusResult,
      authUrl: authUrlResult.url,
      inbox: inboxResult,
      syncRuns: syncRunsResult,
      flash: event.url.searchParams.get("connected") === "1" ? "connected" : null,
      error: event.url.searchParams.get("error") ?? null,
    };
  } catch {
    return {
      tracking: { status: "not_configured" as const, email: null, messages: [], lastSyncAt: null, pendingCount: 0 },
      authUrl: null,
      inbox: { messages: [], total: 0 },
      syncRuns: [],
      flash: null,
      error: null,
    };
  }
};
