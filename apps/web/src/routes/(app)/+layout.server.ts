import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types.js";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    const redirectTo = url.pathname !== "/" ? `?redirect=${encodeURIComponent(url.pathname)}` : "";
    redirect(302, `/sign-in${redirectTo}`);
  }

  return {
    user: locals.user,
  };
};
