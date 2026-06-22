import { trpcServer } from "$lib/server/trpc/server.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  const trpc = await trpcServer(event);
  const jobs = await trpc.tracer.analytics({ limit: 50 });
  return { jobs };
};
