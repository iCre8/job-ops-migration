import { redirect } from "@sveltejs/kit";
import { trpcServer } from "$lib/server/trpc/server.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  if (event.locals.user) {
    redirect(302, "/jobs");
  }

  const trpc = await trpcServer(event);
  const { setupRequired } = await trpc.auth.bootstrapStatus();

  if (!setupRequired) {
    redirect(302, "/sign-in");
  }

  return {};
};
