import type { Handle } from "@sveltejs/kit";
import { verifyToken } from "$lib/server/auth/jwt.js";

export const handle: Handle = async ({ event, resolve }) => {
  const requestId =
    event.request.headers.get("x-request-id") ?? crypto.randomUUID();
  event.locals.requestId = requestId;

  const token = event.cookies.get("jobops_token");
  if (token) {
    try {
      const payload = await verifyToken(token);
      event.locals.user = {
        id: payload.userId,
        username: payload.username,
        isSystemAdmin: payload.isSystemAdmin,
      };
    } catch {
      // Invalid/expired token — treat as unauthenticated and clear the stale cookie
      event.cookies.delete("jobops_token", { path: "/" });
    }
  }

  const response = await resolve(event);
  response.headers.set("x-request-id", requestId);
  return response;
};
