import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "./provider.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface DOSpacesConfig {
  /** DO Spaces bucket name (e.g. "jobops-resumes") */
  bucket: string;
  /** Optional CDN base URL for public object URLs. Falls back to endpoint URL. */
  cdnUrl?: string | null;
  /**
   * Pre-configured S3Client instance.
   * Inject a mocked client in tests; use createDefaultS3Client() in production.
   */
  client: S3Client;
}

/**
 * Create an S3Client pointed at DigitalOcean Spaces.
 * Reads DO_SPACES_ENDPOINT, DO_SPACES_KEY, DO_SPACES_SECRET from env.
 */
export function createDefaultS3Client(): S3Client {
  const endpoint = process.env.DO_SPACES_ENDPOINT;
  const accessKeyId = process.env.DO_SPACES_KEY;
  const secretAccessKey = process.env.DO_SPACES_SECRET;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "DO Spaces requires DO_SPACES_ENDPOINT, DO_SPACES_KEY, and DO_SPACES_SECRET to be set.",
    );
  }

  return new S3Client({
    endpoint,
    // Region is required by the SDK but overridden by the endpoint.
    // DigitalOcean Spaces ignores the region value.
    region: "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
    // DO Spaces uses virtual-hosted-style URLs (bucket.region.digitaloceanspaces.com)
    forcePathStyle: false,
  });
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class DOSpacesProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly cdnUrl: string | null;

  constructor(config: DOSpacesConfig) {
    this.client = config.client;
    this.bucket = config.bucket;
    this.cdnUrl = config.cdnUrl ?? null;
  }

  /**
   * Read the stream to a buffer then upload in a single PutObject call.
   * DO Spaces does not support streaming multipart uploads below 5 MB,
   * so buffering is the safe default for resume PDFs (typically < 500 KB).
   */
  async write(
    key: string,
    stream: NodeJS.ReadableStream,
    contentType = "application/pdf",
  ): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Private by default — access granted via signed URLs only
        ACL: "private",
      }),
    );
  }

  /**
   * HeadObject to check existence. Returns false on any error (NoSuchKey,
   * permissions, network) rather than throwing — callers treat absence
   * as "not yet generated".
   */
  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /**
   * Generate a pre-signed GET URL valid for `expiresIn` seconds (default 1 hour).
   * The signed URL allows unauthenticated download — use for browser redirects.
   */
  async signedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  /**
   * Returns the CDN URL if configured, otherwise the direct bucket URL.
   * Only use for objects that are explicitly made public.
   */
  publicUrl(key: string): string {
    if (this.cdnUrl) {
      // Normalise trailing slash on CDN base
      const base = this.cdnUrl.replace(/\/$/, "");
      return `${base}/${key}`;
    }
    const endpoint = process.env.DO_SPACES_ENDPOINT?.replace(/\/$/, "") ?? "";
    return `${endpoint}/${this.bucket}/${key}`;
  }
}
