# issues-log.md
# Job-Ops Migration — Issue Tracker

> **Instructions:** See `Init-instruction.md` in project-notes for issue creation rules,
> severity definitions, and RCA requirements. Every issue must reach CLOSED status before
> its phase can be marked COMPLETE.

---

## Summary Table

| ID | Severity | Phase | Title | Status | Opened | Closed |
|---|---|---|---|---|---|---|
| ISSUE-001 | P1-Critical | Phase 1 — Data Model | Prisma v7 has no MongoDB adapter; `url` removed from schema | CLOSED | 2026-03-31 | 2026-03-31 |
| ISSUE-002 | P2-Major | Phase 1 — Data Model | `deleteMany()` requires MongoDB replica set; standalone memory server rejected | CLOSED | 2026-03-31 | 2026-03-31 |
| ISSUE-003 | P2-Major | Phase A — Auth | `jobs.apply` is a reserved tRPC router word; throws at startup | CLOSED | 2026-06-21 | 2026-06-21 |
| ISSUE-004 | P2-Major | Phase A — Auth | `AuthSession.@@index([jti])` conflicts with `@unique` on same field | CLOSED | 2026-06-21 | 2026-06-21 |
| ISSUE-005 | P3-Minor | Phase A — Auth | New route directories missing generated `$types.js`; need `svelte-kit sync` | CLOSED | 2026-06-21 | 2026-06-21 |
| ISSUE-006 | P3-Minor | Phase A — Auth | `Prisma.InputJsonObject` cast required for `Json`-typed watchlist config field | CLOSED | 2026-06-21 | 2026-06-21 |
| ISSUE-007 | P2-Major | Phase A — Auth | apps/web admin seed missing and project-level Prisma env not configured | CLOSED | 2026-06-21 | 2026-06-21 |

---

---

### ISSUE-001 — Prisma v7 incompatible with MongoDB: no adapter, `url` removed from schema

| Field | Value |
|---|---|
| **ID** | ISSUE-001 |
| **Severity** | P1-Critical |
| **Phase** | Phase 1 — Data Model |
| **Status** | CLOSED |
| **Opened** | 2026-03-31 |
| **Closed** | 2026-03-31 |
| **Opened by** | Claude Code (discovered during `prisma generate`) |

#### Symptom

Three cascading errors when upgrading to Prisma v7.6.0:

1. `prisma generate` fails: `"The datasource property url is no longer supported in schema
   files"` — schema.prisma `datasource db { url = env("DATABASE_URL") }` is rejected.

2. After removing `url` from schema and adding `prisma.config.ts`, `new PrismaClient()`
   fails: `"Using engine type 'client' requires either 'adapter' or 'accelerateUrl' to be
   provided to PrismaClient constructor."` — the new v7 client engine requires a driver
   adapter for all database connections.

3. `@prisma/adapter-mongodb` does not exist on npm registry (404). No MongoDB adapter has
   been published for Prisma v7.

#### Root Cause

Prisma v7 introduced a breaking architectural change: the binary/library query engine is
replaced by a new "client" engine that **requires a driver adapter** for all connections.
Driver adapters are published as `@prisma/adapter-{database}` packages. For SQL databases
(PostgreSQL, SQLite, MySQL), adapters exist. For MongoDB, **no adapter has been published
as of 2026-03-31**, making Prisma v7 + MongoDB non-functional.

The plan specified "Prisma v7" without verifying MongoDB adapter availability in v7. Prisma
v6 is the latest version with stable, fully-supported MongoDB connectivity.

#### Contributing Factors

- Plan was written before confirming `@prisma/adapter-mongodb` availability in v7.
- Prisma v7's breaking changes are significant enough that the major version bump does not
  guarantee feature parity with v6 for all providers.
- npm version ranges (`^7`) resolved to 7.6.0 automatically, triggering the incompatibility.

#### Resolution

Downgraded Prisma to v6 (`^6.0.0`). All three error sources are resolved in v6:
- `url` in `datasource db` is supported.
- No adapter required — library engine handles MongoDB directly.
- `datasources: { db: { url } }` option accepted by `PrismaClient` constructor.

Reverted:
- `prisma/schema.prisma`: restored `url = env("DATABASE_URL")` in datasource.
- `src/lib/server/db/index.ts`: reverted `createClient()` and `createTestClient()` to use
  `datasources` option (v6 API).
- Removed `prisma.config.ts` (v7-specific, not needed in v6).

Updated `package.json`:
- `"prisma": "^6.0.0"`
- `"@prisma/client": "^6.0.0"`

#### Prevention

- **Gate check:** Before committing to a specific ORM version in planning documents,
  verify adapter/driver availability for the target database in that version.
- **Upgrade path:** Add a task to `Status.md` Decisions Log to upgrade to Prisma v7 +
  `@prisma/adapter-mongodb` once the adapter is published. Monitor
  https://github.com/prisma/prisma/issues for MongoDB adapter availability.
- **Test:** The integration test suite now serves as a regression guard — if a future
  Prisma upgrade breaks MongoDB compatibility, tests will fail before any code ships.

#### Related Issues

None.

---

---

### ISSUE-002 — `deleteMany()` fails: MongoDB standalone instance does not support transactions

| Field | Value |
|---|---|
| **ID** | ISSUE-002 |
| **Severity** | P2-Major |
| **Phase** | Phase 1 — Data Model |
| **Status** | CLOSED |
| **Opened** | 2026-03-31 |
| **Closed** | 2026-03-31 |
| **Opened by** | Claude Code (discovered during test run) |

#### Symptom

All 29 integration tests fail in `beforeEach` with:
```
PrismaClientKnownRequestError: Prisma needs to perform transactions, which requires your
MongoDB server to be run as a replica set.
```
The error originates from `prisma.job.deleteMany()` and all other `deleteMany()` calls in
the test cleanup block. Tests report 29 skipped (not run due to setup failure).

#### Root Cause

Prisma's `deleteMany()` for MongoDB uses multi-document transactions internally to ensure
atomicity. MongoDB requires a **replica set** (even a single-node one) to support
transactions. `MongoMemoryServer.create()` (from `mongodb-memory-server`) starts a
**standalone** MongoDB instance by default, which does not support transactions.

#### Contributing Factors

- `deleteMany()` is a natural, idiomatic cleanup operation — its transaction requirement is
  not obvious from the Prisma docs without reading the MongoDB-specific caveats.
- `mongodb-memory-server` defaults to standalone; replica set must be explicitly requested.
- The test cleanup pattern (`beforeEach` + `deleteMany`) is standard Prisma testing practice
  for SQL databases but requires extra setup for MongoDB.

#### Resolution

Replaced `MongoMemoryServer` with `MongoMemoryReplSet` (single-node replica set) in the
test setup. This satisfies Prisma's transaction requirement with minimal overhead.

```typescript
import { MongoMemoryReplSet } from "mongodb-memory-server";
mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
```

#### Prevention

- **Standard:** All integration tests using Prisma + MongoDB must use `MongoMemoryReplSet`,
  not `MongoMemoryServer`. Added comment in test file explaining this requirement.
- **Documentation:** Add a note to `build-process.md` Phase 1 section and to the db README.

#### Related Issues

ISSUE-001 (same test run)

---

### ISSUE-003 — `jobs.apply` is a reserved tRPC router word

| Field | Value |
|---|---|
| **ID** | ISSUE-003 |
| **Severity** | P2-Major |
| **Phase** | Phase A — Auth / Phase B — Job Detail |
| **Status** | CLOSED |
| **Opened** | 2026-06-21 |
| **Closed** | 2026-06-21 |

#### Symptom

Server threw at startup: `Reserved words used in router({}) call: apply`. The `jobs.apply` mutation caused this error and prevented the dev server from starting.

#### Root Cause

tRPC v11 internally calls `Object.assign` / property assignment on the router object. `apply` is a reserved property on JavaScript `Function.prototype` and tRPC explicitly guards against it.

#### Resolution

Renamed `apply` → `markApplied` in `apps/web/src/lib/server/trpc/routers/jobs.ts` and updated all client call sites in `src/routes/(app)/jobs/[id]/+page.svelte`.

#### Prevention

Avoid `apply`, `call`, `bind`, `constructor`, `prototype` as tRPC procedure names.

---

### ISSUE-004 — `AuthSession.@@index([jti])` conflicts with `@unique`

| Field | Value |
|---|---|
| **ID** | ISSUE-004 |
| **Severity** | P2-Major |
| **Phase** | Phase A — Auth |
| **Status** | CLOSED |
| **Opened** | 2026-06-21 |
| **Closed** | 2026-06-21 |

#### Symptom

`pnpm db:generate` failed: Prisma rejected the schema because `AuthSession.jti` had both `@unique` (field-level) and `@@index([jti])` (model-level), which creates a redundant/conflicting index definition.

#### Resolution

Removed `@@index([jti])` from `AuthSession`. The `@unique` directive already creates a unique index; the explicit `@@index` is redundant and rejected by Prisma's validator.

---

### ISSUE-005 — New route directories missing generated `$types.js`

| Field | Value |
|---|---|
| **ID** | ISSUE-005 |
| **Severity** | P3-Minor |
| **Phase** | Phase A — Auth |
| **Status** | CLOSED |
| **Opened** | 2026-06-21 |
| **Closed** | 2026-06-21 |

#### Symptom

IDE and `svelte-check` reported `Cannot find module './$types.js'` in newly created route files (`sign-in/`, `onboarding/`).

#### Resolution

Ran `npx svelte-kit sync` to regenerate `.svelte-kit/` type stubs. Must be re-run whenever new route directories are added.

---

### ISSUE-006 — `Prisma.InputJsonObject` required for `Json`-typed fields

| Field | Value |
|---|---|
| **ID** | ISSUE-006 |
| **Severity** | P3-Minor |
| **Phase** | Phase F — Watchlist |
| **Status** | CLOSED |
| **Opened** | 2026-06-21 |
| **Closed** | 2026-06-21 |

#### Symptom

TypeScript error: `Type 'Record<string, unknown>' is not assignable to type 'InputJsonValue'` when passing a `z.record(z.string(), z.unknown())` value into a Prisma `Json` field.

#### Resolution

Import `Prisma` namespace from `@prisma/client` and cast: `const config = (input.config ?? null) as Prisma.InputJsonObject | null`. This satisfies Prisma's input type without losing the runtime value.

---

---

### ISSUE-007 — apps/web admin seed missing, Prisma Studio port drift, and Studio embedded client env loading

| Field | Value |
|---|---|
| **ID** | ISSUE-007 |
| **Severity** | P2-Major |
| **Phase** | Phase A — Auth |
| **Status** | CLOSED |
| **Opened** | 2026-06-21 |
| **Closed** | 2026-06-21 |
| **Opened by** | Codex (reported during local Prisma troubleshooting) |

#### Symptom

Local `apps/web` database setup did not have a repeatable command for creating the first admin user. `pnpm db:studio` could also appear inconsistent when Prisma Studio auto-selected a fallback port instead of the expected URL.

#### Root Cause

The app had runtime onboarding and admin-user creation routes, but no package-level seed script for operators or CI. Documentation still referenced obsolete first-run variables and PostgreSQL setup notes. Prisma Studio was not pinned to a deterministic port.

#### Resolution

Standardized on project-level `apps/web/.env` so Prisma Studio and seed commands resolve `DATABASE_URL` from the Nx project cwd without custom wrapper code.

Added `apps/web/prisma/seed.ts`, `pnpm db:seed`, and the Nx `db-seed` target. The seed uses `SEED_ADMIN_USERNAME`, required `SEED_ADMIN_PASSWORD`, and optional `SEED_ADMIN_DISPLAY_NAME`; it upserts the user, hashes the password with scrypt, grants system-admin access, and re-enables the account. Updated `db:studio` to call Prisma directly with `./prisma/schema.prisma --port 5555`; it expects `DATABASE_URL` in `apps/web/.env` or the shell.

#### Prevention

Keep app-local Prisma commands in `apps/web/package.json` and `apps/web/project.json` synchronized. When troubleshooting Studio, confirm `apps/web/.env` exists and contains `DATABASE_URL`, then check whether port `5555` is already in use.
