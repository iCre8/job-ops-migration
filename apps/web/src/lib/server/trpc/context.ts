import type { RequestEvent } from "@sveltejs/kit";
import { getPrisma } from "../db/index.js";

export async function createContext(event: RequestEvent) {
  return {
    prisma: getPrisma(),
    requestId: event.request.headers.get("x-request-id") ?? crypto.randomUUID(),
    event,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
