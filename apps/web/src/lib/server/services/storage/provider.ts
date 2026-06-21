/**
 * StorageProvider — interface for object storage backends.
 *
 * All PDF generation and retrieval flows operate through this interface.
 * The only production implementation is DOSpacesProvider (Phase 3).
 * Additional implementations (local disk, S3, R2) can be added without
 * touching any calling code.
 *
 * Key conventions:
 * - `key` is always a relative object path (e.g. "resume_abc123.pdf")
 * - `write` consumes a readable stream — callers do not need to buffer first
 * - `exists` returns false on any error (not-found or permissions)
 * - `signedDownloadUrl` returns a short-lived URL safe for direct browser use
 * - `publicUrl` returns a permanent URL (CDN or bucket endpoint) — only use
 *   for objects that are intentionally public
 */
export interface StorageProvider {
  /**
   * Upload a readable stream to object storage under the given key.
   * Overwrites any existing object at that key.
   */
  write(
    key: string,
    stream: NodeJS.ReadableStream,
    contentType?: string,
  ): Promise<void>;

  /**
   * Return true if the object exists in storage, false otherwise.
   * Never throws — returns false on any error.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Permanently delete an object. No-op if the object does not exist.
   */
  delete(key: string): Promise<void>;

  /**
   * Return a pre-signed URL that allows a browser to download the object
   * directly without credentials. URL expires after `expiresIn` seconds
   * (default: 3600 — 1 hour).
   */
  signedDownloadUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Return the permanent public URL for an object.
   * Uses the CDN URL if configured, otherwise falls back to the bucket endpoint.
   */
  publicUrl(key: string): string;
}
