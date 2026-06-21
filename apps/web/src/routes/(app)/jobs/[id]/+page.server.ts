import { redirect } from "@sveltejs/kit";
import { trpcServer } from "$lib/server/trpc/server.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const { id } = event.params;

  try {
    const trpc = await trpcServer(event);
    const job = await trpc.jobs.byId({ id });
    return { job };
  } catch (err) {
    // NOT_FOUND or DB unavailable — send back to list
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND" || code === "ECONNREFUSED") {
      redirect(302, "/jobs");
    }
    redirect(302, "/jobs");
  }
};
