import { trpcServer } from "$lib/server/trpc/server.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const status = event.url.searchParams.get("status") ?? "ready";
  const page = Number(event.url.searchParams.get("page") ?? "1");

  try {
    const trpc = await trpcServer(event);
    const [{ jobs, total, pageSize }, activeRun, recentRuns] = await Promise.all([
      trpc.jobs.list({ status, page, pageSize: 50 }),
      trpc.pipeline.currentRun().catch(() => null),
      trpc.pipeline.list({ limit: 5 }).catch(() => []),
    ]);
    return { jobs, total, page, pageSize, status, activeRun, recentRuns };
  } catch {
    return { jobs: [], total: 0, page: 1, pageSize: 50, status, activeRun: null };
  }
};
