import type { Handle } from "@sveltejs/kit";

/**
 * Global server-side hook.
 *
 * Responsibilities:
 *   1. Propagate or generate a request ID for every inbound request.
 *      The ID is stored in event.locals.requestId and echoed back in the
 *      x-request-id response header (mirrors the legacy REST API contract).
 *
 * Phase 6 (MVP scaffold). Additional middleware (auth, rate-limiting) added
 * in later phases.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const requestId =
    event.request.headers.get("x-request-id") ?? crypto.randomUUID();

  event.locals.requestId = requestId;

  const response = await resolve(event);
  response.headers.set("x-request-id", requestId);
  return response;
};
