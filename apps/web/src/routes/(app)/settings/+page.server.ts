import { trpcServer } from "$lib/server/trpc/server.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  try {
    const trpc = await trpcServer(event);
    const settings = await trpc.settings.get();
    return { settings };
  } catch {
    return { settings: {} as Record<string, unknown> };
  }
};
