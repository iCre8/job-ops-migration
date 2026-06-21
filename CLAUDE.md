# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Job-Ops Migration is a self-hosted job application orchestrator rebuilt on a modern stack. It scrapes job boards via a Python sidecar, scores jobs with AI, generates tailored PDFs via RxResume, and tracks application emails via Gmail OAuth.

**Stack:** SvelteKit 2 + Svelte 5 (SSR via adapter-node), tRPC v11, MongoDB 7 + Prisma v6, DigitalOcean Spaces (S3-compatible PDF storage), Python/FastAPI extractor sidecar.

Node version is locked via Volta to `22`.

## Development Commands

```bash
# Start dev server (Vite on :5173)
pnpm dev

# Database
pnpm db:push        # Apply schema changes (no migrations — MongoDB doesn't use prisma migrate)
pnpm db:generate    # Regenerate Prisma client after schema changes
pnpm db:studio      # Prisma Studio UI

# Testing
pnpm test           # Watch mode (Vitest)
pnpm test:run       # CI mode (run once)
pnpm test:coverage  # Coverage report

# Run a single test file
npx vitest run tests/path/to/file.test.ts

# Lint & type-check
pnpm lint           # ESLint
pnpm lint:fix       # ESLint auto-fix
pnpm check          # svelte-kit sync + svelte-check + TypeScript
pnpm check:types    # TypeScript only
```

## CI-Parity Checks (Run Before Completing Work)

```bash
pnpm lint
pnpm check:types
pnpm test:run
```

## Local Development Setup

`pnpm dev` alone is not enough — MongoDB must be running. The easiest way:

```bash
# Start only the MongoDB container (no need to build the web image)
docker compose up -d mongo
```

For the `.env` file, copy `.env.example` and uncomment `DATABASE_URL` for local dev:
```
DATABASE_URL=mongodb://jobops:<password>@localhost:27017/jobops?authSource=admin
```

All other services (extractor sidecar, DO Spaces, RxResume, Gmail) are optional for basic UI work but required for pipeline runs.

## Architecture

### tRPC Routers (`src/lib/server/trpc/routers/`)

All API logic is here. Each router is a collection of `query` and `mutation` procedures:

- `pipeline.ts` — `trigger()` mutation creates a `PipelineRun`; `list()` and `byId()` queries. **No try/catch in `trigger()`** — Prisma errors bubble as HTTP 500.
- `jobs.ts` — CRUD + `generatePdf()` mutation (orchestrates RxResume → DO Spaces upload).
- `tracking.ts` — Gmail sync, OAuth token refresh, integration management.
- `settings.ts` — Application configuration persisted in MongoDB.
- `_app.ts` — Root router that combines all sub-routers.

tRPC error codes map to HTTP status: `INTERNAL_SERVER_ERROR` → 500, `NOT_FOUND` → 404, `UNAUTHORIZED` → 401.

### Services (`src/lib/server/services/`)

Pure business logic, no tRPC coupling:

- `pdf/` — RxResume login → import temp resume → print to PDF → upload to DO Spaces
- `storage/` — `DOSpacesProvider` wrapping the AWS S3 SDK
- `gmail/` — Gmail OAuth token management + email classification
- `extractors/jobspy.ts` — HTTP client for the Python sidecar
- `rxresume/client.ts` — RxResume API client

### SvelteKit Routes (`src/routes/`)

- `(app)/` — SSR pages with `+page.server.ts` loading data via the server-side tRPC caller
- `api/trpc/[trpc]/+server.ts` — tRPC HTTP adapter (all client mutations/queries hit here)
- `api/pipeline/stream/+server.ts` — SSE endpoint for real-time pipeline progress (EventEmitter-based)
- `oauth/gmail/callback/+server.ts` — Gmail OAuth redirect handler
- `pdfs/[jobId]/+server.ts` — Redirects to the public DO Spaces CDN URL for a job's PDF
- `health/+server.ts` — Liveness probe (`{ ok: true }`)

### Database (`src/lib/server/db/index.ts`)

`getPrisma()` returns a singleton `PrismaClient`. In tests, use `createTestClient(url)` to inject a URL pointing at the in-memory replica set.

**Prisma v6 lock:** Prisma v7 has no MongoDB adapter (`@prisma/adapter-mongodb` not published). Do not upgrade until available. See ISSUE-001 in `issues-log.md`.

### Integration Tests

All integration tests use `MongoMemoryReplSet` (not `MongoMemoryServer`) because Prisma's `deleteMany()` on MongoDB requires a replica set to support transactions. Tests live in `tests/integration/`.

Coverage thresholds: 80% lines, 80% functions, 75% branches (enforced in `vite.config.ts`).

## Environment Variables

Required at runtime (see `.env.example` for full list):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MongoDB connection string |
| `DO_SPACES_ENDPOINT` / `KEY` / `SECRET` / `BUCKET` | PDF storage |
| `LLM_API_KEY` / `MODEL` | AI job scoring |
| `RXRESUME_URL` / `EMAIL` / `PASSWORD` | PDF generation |
| `EXTRACTOR_URL` | Python sidecar (default: `http://localhost:8000`) |

Gmail OAuth (`GMAIL_OAUTH_CLIENT_ID`, `_SECRET`, `_REDIRECT_URI`) is only needed for email tracking.
