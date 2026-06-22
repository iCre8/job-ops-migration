import { trpcServer } from "$lib/server/trpc/server.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  try {
    const trpc = await trpcServer(event);
    const data = await trpc.analytics.overview({ days: 30 });
    return { analytics: data, days: 30 };
  } catch {
    return { analytics: null, days: 30 };
  }
};
