/**
 * GET /api/t/[token]
 *
 * Tracer link click handler. Finds the job with a matching TracerLink token,
 * records a TracerClickEvent, updates clickCount/lastClickAt on the embedded
 * TracerLink, then redirects to the original job posting URL.
 */

import { getPrisma } from "$lib/server/db/index.js";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = async ({ params, request, getClientAddress }) => {
  const { token } = params;

  const job = await getPrisma().job.findFirst({
    where: { tracerLinks: { some: { token } } },
  });

  if (!job) {
    return new Response("Not found", { status: 404 });
  }

  const link = job.tracerLinks.find((l) => l.token === token);
  const targetUrl = job.url ?? null;

  // Record click asynchronously — don't block redirect
  Promise.all([
    getPrisma().tracerClickEvent.create({
      data: {
        jobId: job.id,
        linkToken: token,
        ip: getClientAddress(),
        userAgent: request.headers.get("user-agent"),
        referrer: request.headers.get("referer"),
      },
    }),
    link
      ? getPrisma().job.update({
          where: { id: job.id },
          data: {
            tracerLinks: job.tracerLinks.map((l) =>
              l.token === token
                ? { ...l, clickCount: l.clickCount + 1, lastClickAt: new Date() }
                : l,
            ),
          },
        })
      : Promise.resolve(),
  ]).catch(() => undefined);

  if (!targetUrl) {
    return new Response("No target URL configured for this link.", { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: targetUrl },
  });
};
