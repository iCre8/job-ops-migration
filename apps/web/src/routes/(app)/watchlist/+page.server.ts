import { trpcServer } from "$lib/server/trpc/server.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  const trpc = await trpcServer(event);
  const [sources, { items: results }] = await Promise.all([
    trpc.watchlist.sources.list(),
    trpc.watchlist.results.list({ decision: "unseen", limit: 50 }).catch(() => ({ items: [], nextCursor: null })),
  ]);
  return { sources, results };
};
