/**
 * PDF generation service — Phase 10.
 *
 * Flow:
 *   1. Load RxResume credentials from the Settings singleton in MongoDB.
 *   2. Login to RxResume → access token.
 *   3. Import a temporary resume with the provided data → temp resume ID.
 *   4. Trigger PDF print → PDF URL.
 *   5. Delete the temporary resume (in finally — best effort).
 *   6. Download PDF bytes from the returned URL.
 *   7. Upload to DO Spaces via StorageProvider.
 *   8. Update the Job document: pdfStorageKey, pdfPublicUrl, pdfGeneratedAt.
 *   9. Return { storageKey, publicUrl }.
 */

import { Readable } from "node:stream";
import type { PrismaClient } from "@prisma/client";
import { getStorageProvider } from "$lib/server/services/storage/index.js";
import {
  deleteResume,
  importResume,
  login,
  printResume,
} from "$lib/server/services/rxresume/client.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PdfGenerateInput = {
  /** MongoDB Job._id */
  jobId: string;
  /** Full resume JSON to import into RxResume */
  resumeData: Record<string, unknown>;
  /** Optional display name for the temporary RxResume record */
  title?: string;
};

export type PdfResult = {
  storageKey: string;
  publicUrl: string;
};

// ── generateJobPdf ────────────────────────────────────────────────────────────

export async function generateJobPdf(
  input: PdfGenerateInput,
  prisma: PrismaClient,
): Promise<PdfResult> {
  // 1. Load credentials from Settings singleton
  const settings = await prisma.settings.findFirst({
    where: { id: "singleton" },
  });
  const cfg = (settings?.data ?? {}) as Record<string, unknown>;

  const baseUrl = (cfg.rxResumeUrl as string | undefined)?.trim() ?? "";
  const email = (cfg.rxResumeEmail as string | undefined)?.trim() ?? "";
  const password = (cfg.rxResumePass as string | undefined)?.trim() ?? "";

  if (!baseUrl || !email || !password) {
    throw new Error(
      "RxResume credentials not configured. Set rxResumeUrl, rxResumeEmail, and rxResumePass in Settings.",
    );
  }

  // 2. Authenticate
  const token = await login(email, password, baseUrl);

  // 3. Import temporary resume → 4. Print → 5. Delete (finally)
  let tempResumeId: string | null = null;
  let pdfUrl: string;

  try {
    tempResumeId = await importResume(token, baseUrl, {
      name: input.title ?? `JobOps Resume ${input.jobId}`,
      data: input.resumeData,
    });

    pdfUrl = await printResume(token, baseUrl, tempResumeId);
  } finally {
    if (tempResumeId) {
      // Best-effort cleanup — do not let a cleanup failure mask the real error
      await deleteResume(token, baseUrl, tempResumeId).catch(() => undefined);
    }
  }

  // 6. Download PDF bytes
  const pdfRes = await fetch(pdfUrl, { signal: AbortSignal.timeout(60_000) });
  if (!pdfRes.ok || !pdfRes.body) {
    throw new Error(`PDF download failed: HTTP ${pdfRes.status}`);
  }

  // Convert Web ReadableStream to Node.js Readable for StorageProvider.write()
  const pdfStream = Readable.fromWeb(
    pdfRes.body as import("stream/web").ReadableStream<Uint8Array>,
  );

  // 7. Upload to object storage
  const storageKey = `resumes/${input.jobId}.pdf`;
  const storage = getStorageProvider();
  await storage.write(storageKey, pdfStream, "application/pdf");

  // 8. Persist PDF metadata on the job
  const publicUrl = storage.publicUrl(storageKey);
  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      pdfStorageKey: storageKey,
      pdfPublicUrl: publicUrl,
      pdfGeneratedAt: new Date(),
    },
  });

  // 9. Return result
  return { storageKey, publicUrl };
}
