import { trpcServer } from "$lib/server/trpc/server.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  try {
    const trpc = await trpcServer(event);
    const resumes = await trpc.designResume.list();
    return { resumes, error: null };
  } catch (err) {
    return {
      resumes: [],
      error: err instanceof Error ? err.message : "Failed to load resumes",
    };
  }
};
