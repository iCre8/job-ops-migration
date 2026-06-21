import { redirect } from "@sveltejs/kit";
import { trpcServer } from "$lib/server/trpc/server.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  if (event.locals.user) {
    const dest = event.url.searchParams.get("redirect") ?? "/jobs";
    redirect(302, dest);
  }

  // If no users exist yet, redirect to first-run setup
  const trpc = await trpcServer(event);
  const { setupRequired } = await trpc.auth.bootstrapStatus();
  if (setupRequired) {
    redirect(302, "/onboarding");
  }

  return {};
};
