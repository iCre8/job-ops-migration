/**
 * GET /pdfs/:jobId
 *
 * Redirects the client to the job's PDF public URL stored in DO Spaces.
 * Returns 404 if the job does not exist or no PDF has been generated yet.
 *
 * This route keeps PDF URLs stable — even if the storage key or CDN URL
 * changes, callers only need to know the job ID.
 */

import { getPrisma } from "$lib/server/db/index.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
  const { jobId } = params;

  const prisma = getPrisma();
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { pdfPublicUrl: true },
  });

  if (!job || !job.pdfPublicUrl) {
    return new Response("PDF not found", { status: 404 });
  }

  return Response.redirect(job.pdfPublicUrl, 302);
};
