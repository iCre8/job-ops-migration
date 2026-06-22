import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) {
    redirect(302, "/overview");
  }
  redirect(302, "/sign-in");
};
