import { error } from "@sveltejs/kit";
import { trpcServer } from "$lib/server/trpc/server.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user?.isSystemAdmin) {
    error(403, "Forbidden");
  }

  const trpc = await trpcServer(event);
  const users = await trpc.auth.listUsers();
  return { users };
};
