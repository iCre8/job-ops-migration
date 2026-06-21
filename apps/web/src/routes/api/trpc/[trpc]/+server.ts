import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "$lib/server/trpc/context.js";
import { appRouter } from "$lib/server/trpc/routers/_app.js";
import type { RequestHandler } from "./$types";

const handler: RequestHandler = (event) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req: event.request,
    router: appRouter,
    createContext: () => createContext(event),
  });

export const GET = handler;
export const POST = handler;
