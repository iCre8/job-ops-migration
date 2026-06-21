/**
 * server.ts — Server-side tRPC caller factory for use in +page.server.ts files.
 *
 * Usage in a SvelteKit page server:
 *
 *   import { trpcServer } from "$lib/server/trpc/server.js";
 *
 *   export const load: PageServerLoad = async (event) => {
 *     const trpc = await trpcServer(event);
 *     const { jobs, total } = await trpc.jobs.list({ status: "ready" });
 *     return { jobs, total };
 *   };
 *
 * The context is created from the request event (requestId from locals,
 * Prisma singleton) and passed directly to the router. No HTTP round-trip
 * is made — procedures execute in-process.
 */

import type { RequestEvent } from "@sveltejs/kit";
import { createContext } from "./context.js";
import { createCallerFactory } from "./init.js";
import { appRouter } from "./routers/_app.js";

const factory = createCallerFactory(appRouter);

export async function trpcServer(event: RequestEvent) {
  return factory(await createContext(event));
}
