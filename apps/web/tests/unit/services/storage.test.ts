/**
 * Phase 3 — Storage Service Unit Tests
 *
 * Tests DOSpacesProvider methods in isolation using aws-sdk-client-mock.
 * No real network calls — all S3 commands are intercepted.
 *
 * Coverage targets: write, exists, delete, signedDownloadUrl, publicUrl,
 * createDefaultS3Client validation, getStorageProvider singleton.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { Readable } from "node:stream";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock presigner — getSignedUrl is not intercepted by aws-sdk-client-mock
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://signed.example.com/resume_abc.pdf?token=xxx"),
}));

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  DOSpacesProvider,
  createDefaultS3Client,
} from "../../../src/lib/server/services/storage/do-spaces.js";
import {
  getStorageProvider,
  resetStorageProvider,
  setStorageProvider,
} from "../../../src/lib/server/services/storage/index.js";

// ─── Shared setup ─────────────────────────────────────────────────────────────

const s3Mock = mockClient(S3Client);

function makeProvider(overrides?: { cdnUrl?: string | null }) {
  const client = new S3Client({});
  return new DOSpacesProvider({
    bucket: "test-bucket",
    cdnUrl: overrides?.cdnUrl ?? null,
    client,
  });
}

beforeEach(() => {
  s3Mock.reset();
  resetStorageProvider();
  // Set required env vars
  process.env.DO_SPACES_ENDPOINT = "https://nyc3.digitaloceanspaces.com";
  process.env.DO_SPACES_KEY = "test-key";
  process.env.DO_SPACES_SECRET = "test-secret";
  process.env.DO_SPACES_BUCKET = "test-bucket";
  process.env.DO_SPACES_CDN_URL = "";
});

afterEach(() => {
  resetStorageProvider();
  vi.clearAllMocks();
});

// ─── write() ─────────────────────────────────────────────────────────────────

describe("DOSpacesProvider.write()", () => {
  it("sends a PutObjectCommand with the correct key and bucket", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const provider = makeProvider();

    const stream = Readable.from(["hello world"]);
    await provider.write("resume_abc.pdf", stream);

    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.Key).toBe("resume_abc.pdf");
    expect(calls[0].args[0].input.Bucket).toBe("test-bucket");
  });

  it("sets ContentType to application/pdf by default", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const provider = makeProvider();

    await provider.write("file.pdf", Readable.from(["data"]));

    const [call] = s3Mock.commandCalls(PutObjectCommand);
    expect(call.args[0].input.ContentType).toBe("application/pdf");
  });

  it("respects a custom contentType argument", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const provider = makeProvider();

    await provider.write("image.png", Readable.from(["img"]), "image/png");

    const [call] = s3Mock.commandCalls(PutObjectCommand);
    expect(call.args[0].input.ContentType).toBe("image/png");
  });

  it("sets ACL to private", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const provider = makeProvider();

    await provider.write("secret.pdf", Readable.from(["x"]));

    const [call] = s3Mock.commandCalls(PutObjectCommand);
    expect(call.args[0].input.ACL).toBe("private");
  });

  it("buffers multi-chunk streams correctly", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const provider = makeProvider();

    async function* gen() {
      yield Buffer.from("hello ");
      yield Buffer.from("world");
    }
    await provider.write("multi.pdf", Readable.from(gen()));

    const [call] = s3Mock.commandCalls(PutObjectCommand);
    const body = call.args[0].input.Body as Buffer;
    expect(body.toString()).toBe("hello world");
  });

  it("propagates S3 errors", async () => {
    s3Mock.on(PutObjectCommand).rejects(new Error("AccessDenied"));
    const provider = makeProvider();

    await expect(
      provider.write("fail.pdf", Readable.from(["x"])),
    ).rejects.toThrow("AccessDenied");
  });
});

// ─── exists() ────────────────────────────────────────────────────────────────

describe("DOSpacesProvider.exists()", () => {
  it("returns true when HeadObject succeeds", async () => {
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 1234 });
    const provider = makeProvider();

    expect(await provider.exists("resume_abc.pdf")).toBe(true);
  });

  it("returns false when HeadObject throws NotFound", async () => {
    s3Mock.on(HeadObjectCommand).rejects({ name: "NotFound" });
    const provider = makeProvider();

    expect(await provider.exists("missing.pdf")).toBe(false);
  });

  it("returns false on any error (permissions, network, etc.)", async () => {
    s3Mock.on(HeadObjectCommand).rejects(new Error("NetworkError"));
    const provider = makeProvider();

    expect(await provider.exists("any.pdf")).toBe(false);
  });

  it("uses the correct bucket and key", async () => {
    s3Mock.on(HeadObjectCommand).resolves({});
    const provider = makeProvider();

    await provider.exists("resume_xyz.pdf");

    const [call] = s3Mock.commandCalls(HeadObjectCommand);
    expect(call.args[0].input.Bucket).toBe("test-bucket");
    expect(call.args[0].input.Key).toBe("resume_xyz.pdf");
  });
});

// ─── delete() ────────────────────────────────────────────────────────────────

describe("DOSpacesProvider.delete()", () => {
  it("sends a DeleteObjectCommand with the correct key", async () => {
    s3Mock.on(DeleteObjectCommand).resolves({});
    const provider = makeProvider();

    await provider.delete("resume_abc.pdf");

    const calls = s3Mock.commandCalls(DeleteObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.Key).toBe("resume_abc.pdf");
    expect(calls[0].args[0].input.Bucket).toBe("test-bucket");
  });

  it("propagates S3 errors on delete", async () => {
    s3Mock.on(DeleteObjectCommand).rejects(new Error("NoSuchKey"));
    const provider = makeProvider();

    await expect(provider.delete("gone.pdf")).rejects.toThrow("NoSuchKey");
  });
});

// ─── signedDownloadUrl() ──────────────────────────────────────────────────────

describe("DOSpacesProvider.signedDownloadUrl()", () => {
  it("returns the signed URL from getSignedUrl", async () => {
    const provider = makeProvider();
    const url = await provider.signedDownloadUrl("resume_abc.pdf");

    expect(url).toBe("https://signed.example.com/resume_abc.pdf?token=xxx");
  });

  it("calls getSignedUrl with a GetObjectCommand for the correct key", async () => {
    const provider = makeProvider();
    await provider.signedDownloadUrl("my-key.pdf", 1800);

    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.any(S3Client),
      expect.objectContaining({ input: { Bucket: "test-bucket", Key: "my-key.pdf" } }),
      expect.objectContaining({ expiresIn: 1800 }),
    );
  });

  it("defaults expiresIn to 3600 seconds", async () => {
    const provider = makeProvider();
    await provider.signedDownloadUrl("file.pdf");

    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(GetObjectCommand),
      expect.objectContaining({ expiresIn: 3600 }),
    );
  });
});

// ─── publicUrl() ─────────────────────────────────────────────────────────────

describe("DOSpacesProvider.publicUrl()", () => {
  it("returns CDN URL when cdnUrl is configured", () => {
    const provider = makeProvider({ cdnUrl: "https://cdn.example.com" });
    expect(provider.publicUrl("resume_abc.pdf")).toBe(
      "https://cdn.example.com/resume_abc.pdf",
    );
  });

  it("normalises a trailing slash on the CDN URL", () => {
    const provider = makeProvider({ cdnUrl: "https://cdn.example.com/" });
    expect(provider.publicUrl("file.pdf")).toBe(
      "https://cdn.example.com/file.pdf",
    );
  });

  it("falls back to DO_SPACES_ENDPOINT/bucket/key when no CDN", () => {
    process.env.DO_SPACES_ENDPOINT = "https://nyc3.digitaloceanspaces.com";
    const provider = makeProvider({ cdnUrl: null });

    expect(provider.publicUrl("resume_abc.pdf")).toBe(
      "https://nyc3.digitaloceanspaces.com/test-bucket/resume_abc.pdf",
    );
  });

  it("normalises trailing slash on endpoint fallback", () => {
    process.env.DO_SPACES_ENDPOINT = "https://nyc3.digitaloceanspaces.com/";
    const provider = makeProvider({ cdnUrl: null });

    expect(provider.publicUrl("file.pdf")).toBe(
      "https://nyc3.digitaloceanspaces.com/test-bucket/file.pdf",
    );
  });
});

// ─── createDefaultS3Client() ─────────────────────────────────────────────────

describe("createDefaultS3Client()", () => {
  it("throws when DO_SPACES_ENDPOINT is missing", () => {
    delete process.env.DO_SPACES_ENDPOINT;
    expect(() => createDefaultS3Client()).toThrow("DO_SPACES_ENDPOINT");
  });

  it("throws when DO_SPACES_KEY is missing", () => {
    delete process.env.DO_SPACES_KEY;
    expect(() => createDefaultS3Client()).toThrow("DO_SPACES_KEY");
  });

  it("throws when DO_SPACES_SECRET is missing", () => {
    delete process.env.DO_SPACES_SECRET;
    expect(() => createDefaultS3Client()).toThrow("DO_SPACES_SECRET");
  });

  it("returns an S3Client when all env vars are set", () => {
    const client = createDefaultS3Client();
    expect(client).toBeInstanceOf(S3Client);
  });
});

// ─── getStorageProvider() singleton ──────────────────────────────────────────

describe("getStorageProvider() singleton", () => {
  it("returns a DOSpacesProvider when DO_SPACES_BUCKET is set", () => {
    const provider = getStorageProvider();
    expect(provider).toBeInstanceOf(DOSpacesProvider);
  });

  it("returns the same instance on repeated calls", () => {
    expect(getStorageProvider()).toBe(getStorageProvider());
  });

  it("throws when DO_SPACES_BUCKET is not set", () => {
    delete process.env.DO_SPACES_BUCKET;
    expect(() => getStorageProvider()).toThrow("DO_SPACES_BUCKET");
  });

  it("setStorageProvider overrides the singleton", () => {
    const mock: import("../../../src/lib/server/services/storage/provider.js").StorageProvider = {
      write: vi.fn(),
      exists: vi.fn(),
      delete: vi.fn(),
      signedDownloadUrl: vi.fn(),
      publicUrl: vi.fn(),
    };
    setStorageProvider(mock);
    expect(getStorageProvider()).toBe(mock);
  });

  it("resetStorageProvider clears the singleton", () => {
    getStorageProvider(); // populate singleton
    resetStorageProvider();
    // Next call rebuilds from env
    const fresh = getStorageProvider();
    expect(fresh).toBeInstanceOf(DOSpacesProvider);
  });
});
