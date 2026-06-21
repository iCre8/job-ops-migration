import { trpcServer } from "$lib/server/trpc/server.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  try {
    const trpc = await trpcServer(event);
    const [statusResult, authUrlResult] = await Promise.all([
      trpc.tracking.status(),
      trpc.tracking.authUrl(),
    ]);
    return {
      tracking: statusResult,
      authUrl: authUrlResult.url,
      flash: event.url.searchParams.get("connected") === "1" ? "connected" : null,
      error: event.url.searchParams.get("error") ?? null,
    };
  } catch {
    return {
      tracking: { status: "not_configured" as const, email: null, messages: [], lastSyncAt: null },
      authUrl: null,
      flash: null,
      error: null,
    };
  }
};
