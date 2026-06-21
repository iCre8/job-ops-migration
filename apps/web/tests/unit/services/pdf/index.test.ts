/**
 * Unit tests — PDF generation service (generateJobPdf)
 *
 * All external dependencies are mocked:
 *   - RxResume client functions via vi.mock
 *   - StorageProvider singleton via setStorageProvider / resetStorageProvider
 *   - Prisma via typed vi.fn() mock object
 */

import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetStorageProvider,
  setStorageProvider,
} from "../../../../src/lib/server/services/storage/index.js";
import type { StorageProvider } from "../../../../src/lib/server/services/storage/provider.js";

// ── Mock the RxResume client module ───────────────────────────────────────────

vi.mock(
  "../../../../src/lib/server/services/rxresume/client.js",
  () => ({
    login: vi.fn(),
    importResume: vi.fn(),
    printResume: vi.fn(),
    deleteResume: vi.fn(),
  }),
);

import * as rxClient from "../../../../src/lib/server/services/rxresume/client.js";
import { generateJobPdf } from "../../../../src/lib/server/services/pdf/index.js";

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    rxResumeUrl: "http://rx.test",
    rxResumeEmail: "user@test.com",
    rxResumePass: "secret",
    ...overrides,
  };
}

function makePrisma(settingsData: Record<string, unknown> = makeSettings()) {
  return {
    settings: {
      findFirst: vi.fn().mockResolvedValue({ id: "singleton", data: settingsData }),
    },
    job: {
      findUnique: vi.fn().mockResolvedValue({ id: "job-1" }),
      update: vi.fn().mockResolvedValue({ id: "job-1" }),
    },
  };
}

function makeStorage(publicUrlReturn = "https://cdn.example.com/resumes/job-1.pdf"): StorageProvider {
  return {
    write: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(undefined),
    signedDownloadUrl: vi.fn().mockResolvedValue("https://signed.example.com/r.pdf"),
    publicUrl: vi.fn().mockReturnValue(publicUrlReturn),
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let storage: StorageProvider;

beforeEach(() => {
  storage = makeStorage();
  setStorageProvider(storage);

  // Default happy-path RxResume mock responses
  vi.mocked(rxClient.login).mockResolvedValue("tok-abc");
  vi.mocked(rxClient.importResume).mockResolvedValue("temp-resume-id");
  vi.mocked(rxClient.printResume).mockResolvedValue("https://cdn.rx.test/print.pdf");
  vi.mocked(rxClient.deleteResume).mockResolvedValue(undefined);

  // Mock global fetch for PDF download
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: Readable.toWeb(Readable.from(Buffer.from("%PDF-1.4"))),
    } as unknown as Response),
  );
});

afterEach(() => {
  resetStorageProvider();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("generateJobPdf — happy path", () => {
  it("returns storageKey and publicUrl", async () => {
    const prisma = makePrisma();
    const result = await generateJobPdf(
      { jobId: "job-1", resumeData: { foo: "bar" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
    );

    expect(result.storageKey).toBe("resumes/job-1.pdf");
    expect(result.publicUrl).toBe("https://cdn.example.com/resumes/job-1.pdf");
  });

  it("logs in with credentials from settings", async () => {
    const prisma = makePrisma();
    await generateJobPdf({ jobId: "job-1", resumeData: {} }, prisma as any);

    expect(rxClient.login).toHaveBeenCalledWith(
      "user@test.com",
      "secret",
      "http://rx.test",
    );
  });

  it("imports resume with correct name", async () => {
    const prisma = makePrisma();
    await generateJobPdf(
      { jobId: "job-1", resumeData: { key: 1 }, title: "My Custom Resume" },
      prisma as any,
    );

    expect(rxClient.importResume).toHaveBeenCalledWith(
      "tok-abc",
      "http://rx.test",
      expect.objectContaining({ name: "My Custom Resume" }),
    );
  });

  it("deletes the temporary resume after printing", async () => {
    const prisma = makePrisma();
    await generateJobPdf({ jobId: "job-1", resumeData: {} }, prisma as any);

    expect(rxClient.deleteResume).toHaveBeenCalledWith(
      "tok-abc",
      "http://rx.test",
      "temp-resume-id",
    );
  });

  it("uploads to storage with correct key and content-type", async () => {
    const prisma = makePrisma();
    await generateJobPdf({ jobId: "job-1", resumeData: {} }, prisma as any);

    expect(storage.write).toHaveBeenCalledWith(
      "resumes/job-1.pdf",
      expect.anything(), // Readable stream
      "application/pdf",
    );
  });

  it("updates job with pdfStorageKey, pdfPublicUrl, pdfGeneratedAt", async () => {
    const prisma = makePrisma();
    await generateJobPdf({ jobId: "job-1", resumeData: {} }, prisma as any);

    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({
          pdfStorageKey: "resumes/job-1.pdf",
          pdfPublicUrl: "https://cdn.example.com/resumes/job-1.pdf",
          pdfGeneratedAt: expect.any(Date),
        }),
      }),
    );
  });
});

// ── Credential validation ─────────────────────────────────────────────────────

describe("generateJobPdf — missing credentials", () => {
  it("throws when rxResumeUrl is missing", async () => {
    const prisma = makePrisma(makeSettings({ rxResumeUrl: "" }));
    await expect(
      generateJobPdf({ jobId: "j", resumeData: {} }, prisma as any),
    ).rejects.toThrow(/credentials not configured/);
  });

  it("throws when rxResumeEmail is missing", async () => {
    const prisma = makePrisma(makeSettings({ rxResumeEmail: "" }));
    await expect(
      generateJobPdf({ jobId: "j", resumeData: {} }, prisma as any),
    ).rejects.toThrow(/credentials not configured/);
  });

  it("throws when no settings document exists", async () => {
    const prisma = {
      settings: { findFirst: vi.fn().mockResolvedValue(null) },
      job: { update: vi.fn() },
    };
    await expect(
      generateJobPdf({ jobId: "j", resumeData: {} }, prisma as any),
    ).rejects.toThrow(/credentials not configured/);
  });
});

// ── Error propagation ─────────────────────────────────────────────────────────

describe("generateJobPdf — RxResume errors", () => {
  it("propagates login error", async () => {
    vi.mocked(rxClient.login).mockRejectedValue(new Error("Auth failed"));
    const prisma = makePrisma();

    await expect(
      generateJobPdf({ jobId: "j", resumeData: {} }, prisma as any),
    ).rejects.toThrow("Auth failed");
  });

  it("still calls deleteResume when printResume fails", async () => {
    vi.mocked(rxClient.printResume).mockRejectedValue(new Error("Print failed"));
    const prisma = makePrisma();

    await expect(
      generateJobPdf({ jobId: "j", resumeData: {} }, prisma as any),
    ).rejects.toThrow("Print failed");

    // deleteResume must still be called to clean up the temp record
    expect(rxClient.deleteResume).toHaveBeenCalledWith(
      "tok-abc",
      "http://rx.test",
      "temp-resume-id",
    );
  });

  it("does not call deleteResume when importResume fails", async () => {
    vi.mocked(rxClient.importResume).mockRejectedValue(new Error("Import failed"));
    const prisma = makePrisma();

    await expect(
      generateJobPdf({ jobId: "j", resumeData: {} }, prisma as any),
    ).rejects.toThrow("Import failed");

    expect(rxClient.deleteResume).not.toHaveBeenCalled();
  });
});
