import { DOSpacesProvider, createDefaultS3Client } from "./do-spaces.js";
import type { StorageProvider } from "./provider.js";

// ─── Singleton factory ────────────────────────────────────────────────────────
// One provider instance per process. DO Spaces credentials are read from
// environment variables at first call.

let _provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!_provider) {
    const bucket = process.env.DO_SPACES_BUCKET;
    if (!bucket) {
      throw new Error("DO_SPACES_BUCKET environment variable is not set.");
    }
    _provider = new DOSpacesProvider({
      bucket,
      cdnUrl: process.env.DO_SPACES_CDN_URL ?? null,
      client: createDefaultS3Client(),
    });
  }
  return _provider;
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Override the singleton — use in tests to inject a mock provider. */
export function setStorageProvider(provider: StorageProvider): void {
  _provider = provider;
}

/** Reset singleton so the next call to getStorageProvider() rebuilds from env. */
export function resetStorageProvider(): void {
  _provider = null;
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type { StorageProvider } from "./provider.js";
export { DOSpacesProvider, createDefaultS3Client } from "./do-spaces.js";
