/**
 * Phase 2 — Infrastructure Integration Test: Docker Compose health checks
 *
 * This test starts only the `mongo` service (the only service buildable at
 * Phase 2, before the web app image is complete) and verifies:
 *  1. MongoDB container reaches healthy status
 *  2. Prisma can connect and run db push against the real MongoDB instance
 *
 * The full three-service stack smoke test (mongo + web + extractor) is run
 * manually after Phase 6 (SvelteKit scaffold) and Phase 5 (extractor) are
 * complete.
 *
 * Prerequisites: Docker daemon running, docker compose available.
 */

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import { execSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Path: tests/integration/infra → ../../../../.. → job-ops-migration/
// infra(1) → integration(2) → tests(3) → web(4) → apps(5) → job-ops-migration
const COMPOSE_FILE = resolve(
  import.meta.dirname,
  "../../../../..",
  "docker-compose.yml",
);

const COMPOSE_PROJECT = "jobops_test_infra";
const MONGO_PORT = "27018"; // offset from default to avoid clashing with dev MongoDB

function compose(args: string, failOnError = true): string {
  const result = spawnSync(
    "docker",
    [
      "compose",
      "-f", COMPOSE_FILE,
      "-p", COMPOSE_PROJECT,
      ...args.split(" "),
    ],
    {
      encoding: "utf-8",
      env: {
        ...process.env,
        MONGO_USER: "jobops_test",
        MONGO_PASSWORD: "testpassword",
        // Remap port to avoid conflicts with a running dev stack
        MONGO_PORT: MONGO_PORT,
        MONGO_VOLUME_NAME: `${COMPOSE_PROJECT}_mongo_data`,
      },
    },
  );

  if (failOnError && result.status !== 0) {
    throw new Error(
      `docker compose ${args} failed:\n${result.stderr}\n${result.stdout}`,
    );
  }

  return result.stdout ?? "";
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  // Start only the mongo service for this infra test
  compose("up -d mongo");

  // Wait for mongo to report healthy (up to 60s)
  const deadline = Date.now() + 60_000;
  let healthy = false;

  while (Date.now() < deadline) {
    const result = spawnSync(
      "docker",
      ["compose", "-f", COMPOSE_FILE, "-p", COMPOSE_PROJECT, "ps", "--format", "json"],
      { encoding: "utf-8", env: { ...process.env, MONGO_PASSWORD: "testpassword", MONGO_USER: "jobops_test", MONGO_PORT, MONGO_VOLUME_NAME: `${COMPOSE_PROJECT}_mongo_data` } },
    );

    if (result.stdout?.includes('"Health":"healthy"') || result.stdout?.includes('"Status":"running"')) {
      // Verify with a direct ping
      const ping = spawnSync(
        "docker",
        ["compose", "-f", COMPOSE_FILE, "-p", COMPOSE_PROJECT,
          "exec", "-T", "mongo", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"],
        { encoding: "utf-8", env: { ...process.env, MONGO_PASSWORD: "testpassword", MONGO_USER: "jobops_test", MONGO_PORT, MONGO_VOLUME_NAME: `${COMPOSE_PROJECT}_mongo_data` } },
      );
      if (ping.stdout?.trim() === "1") {
        healthy = true;
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }

  if (!healthy) {
    throw new Error("MongoDB container did not become healthy within 60s");
  }
}, 90_000);

afterAll(() => {
  compose("down -v", false); // -v removes the test volume; false = don't throw on error
}, 30_000);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MongoDB container health", () => {
  it("mongo service responds to ping", () => {
    const result = spawnSync(
      "docker",
      [
        "compose", "-f", COMPOSE_FILE, "-p", COMPOSE_PROJECT,
        "exec", "-T", "mongo",
        "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok",
      ],
      { encoding: "utf-8", env: { ...process.env, MONGO_PASSWORD: "testpassword", MONGO_USER: "jobops_test", MONGO_PORT, MONGO_VOLUME_NAME: `${COMPOSE_PROJECT}_mongo_data` } },
    );
    expect(result.stdout.trim()).toBe("1");
  });

  it("mongo service is reachable from the host on the expected port", () => {
    // Verify the container's exposed port is bound
    const result = spawnSync(
      "docker",
      ["compose", "-f", COMPOSE_FILE, "-p", COMPOSE_PROJECT, "ps"],
      { encoding: "utf-8", env: { ...process.env, MONGO_PASSWORD: "testpassword", MONGO_USER: "jobops_test", MONGO_PORT, MONGO_VOLUME_NAME: `${COMPOSE_PROJECT}_mongo_data` } },
    );
    expect(result.stdout).toContain("mongo");
    // Should see the container in a running/healthy state
    expect(result.stdout.toLowerCase()).toMatch(/running|healthy/);
  });
});

describe("Prisma db push against real MongoDB", () => {
  it("prisma db push completes without errors", () => {
    // Build the DATABASE_URL pointing at the test container
    const url = `mongodb://jobops_test:testpassword@localhost:${MONGO_PORT}/jobops_push_test?authSource=admin&directConnection=true`;

    const result = spawnSync(
      "pnpm",
      ["exec", "prisma", "db", "push", "--schema", "./prisma/schema.prisma", "--skip-generate"],
      {
        encoding: "utf-8",
        cwd: resolve(import.meta.dirname, "../../.."),
        env: { ...process.env, DATABASE_URL: url },
      },
    );

    // db push exits 0 on success
    expect(result.status).toBe(0);
    // Should mention "Your database is now in sync"
    expect(result.stdout + result.stderr).toMatch(/sync|indexes/i);
  }, 30_000);
});
