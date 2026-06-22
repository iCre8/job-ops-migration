import { trpcServer } from "$lib/server/trpc/server.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  try {
    const trpc = await trpcServer(event);
    const [settings, backups] = await Promise.all([
      trpc.settings.get(),
      trpc.settings.backups.list().catch(() => []),
    ]);
    return { settings, backups };
  } catch {
    return { settings: {} as Record<string, unknown>, backups: [] };
  }
};
