import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration.
 *
 * The webServer starts the built SvelteKit Node.js server (`node build`).
 * DATABASE_URL must be set in the environment; the smoke tests only hit
 * /health which does not require a live MongoDB connection.
 *
 * Run E2E tests after a successful build:
 *   pnpm nx e2e web
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node build",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
    env: {
      // connectTimeoutMS + serverSelectionTimeoutMS ensure Prisma fails fast
      // when MongoDB is unavailable, so server load catch blocks fire within
      // 2 s rather than hanging for the full 30 s default.
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "mongodb://localhost:27017/jobops_e2e?connectTimeoutMS=2000&serverSelectionTimeoutMS=2000",
      ORIGIN: "http://localhost:3000",
      PORT: "3000",
    },
  },
});
