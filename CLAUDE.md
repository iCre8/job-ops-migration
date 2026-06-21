# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Job-Ops Migration is migrating a self-hosted job application orchestrator from React/Express to SvelteKit. The app scrapes job boards, scores jobs with AI, generates tailored PDFs via RxResume, and tracks application emails via Gmail OAuth.

**Monorepo layout:**
- `apps/web/` — **Migration target (SvelteKit).** SvelteKit 2 + Svelte 5, tRPC v11, MongoDB 7 + Prisma v6. Phases 1–11 complete; Phase 12 (CI Pipeline) is the final remaining gate.
- `orchestrator/` — **Source/legacy app (React).** React 18 + Vite + Express 4 + PostgreSQL/Drizzle. Being replaced by `apps/web/`.
- `shared/` — Types and utilities shared across packages.
- `career-boards/*`, `extractors/*` — Job board and extraction integrations.

**Active development happens in `apps/web/`.** The `orchestrator/` is the thing being migrated away from.

## Development Commands

All commands run from `apps/web/` unless noted.

```bash
# SvelteKit dev server (:5173) — MongoDB must be running first
pnpm dev

# MongoDB (start before pnpm dev)
docker compose up -d mongo

# Database (MongoDB + Prisma v6 — no prisma migrate, schema push only)
pnpm db:push      # Apply schema changes to MongoDB
pnpm db:generate  # Regenerate Prisma client after schema.prisma changes
pnpm db:studio    # Prisma Studio UI

# Testing (Vitest + MongoMemoryReplSet — no external DB needed)
pnpm test           # Watch mode
pnpm test:run       # CI mode (run once)
pnpm test:coverage  # Coverage report

# Run a single test file
npx vitest run tests/integration/trpc/jobs.test.ts

# Lint & type-check
pnpm lint         # ESLint
pnpm lint:fix     # ESLint auto-fix
pnpm check        # svelte-kit sync + svelte-check + TypeScript
pnpm check:types  # TypeScript only
```

## CI-Parity Checks (Run Before Completing Work)

```bash
pnpm lint
pnpm check:types
pnpm test:run
```

## Local Development Setup

MongoDB must be running before `pnpm dev`:

```bash
docker compose up -d mongo    # Start MongoDB only (no need to build web image)
```

Copy `.env.example` → `.env` in the repo root and set `DATABASE_URL`:
```
DATABASE_URL=mongodb://jobops:<password>@localhost:27017/jobops?authSource=admin
```

All other services (DO Spaces, RxResume, Gmail OAuth, Python extractor sidecar) are optional for basic UI work but required for full pipeline runs.

Integration tests use `MongoMemoryReplSet` (not `MongoMemoryServer`) — Prisma's `deleteMany()` requires a replica set for transactions. No external DB needed for tests.

## Architecture (apps/web — SvelteKit migration target)

### tRPC Routers (`src/lib/server/trpc/routers/`)

All API logic lives here. Each router groups `query` and `mutation` procedures:

- `pipeline.ts` — `trigger()` mutation creates a `PipelineRun`; `list()` and `byId()` queries. No try/catch in `trigger()` — Prisma errors bubble as HTTP 500.
- `jobs.ts` — CRUD + `generatePdf()` mutation (RxResume → DO Spaces upload).
- `tracking.ts` — Gmail sync, OAuth token refresh, integration management.
- `settings.ts` — App configuration persisted in MongoDB.
- `_app.ts` — Root router that combines all sub-routers.

tRPC error codes map to HTTP status: `INTERNAL_SERVER_ERROR` → 500, `NOT_FOUND` → 404, `UNAUTHORIZED` → 401.

### Services (`src/lib/server/services/`)

Pure business logic, no tRPC coupling:

- `pdf/` — RxResume login → import temp resume → print to PDF → upload to DO Spaces
- `storage/` — `DOSpacesProvider` wrapping the AWS S3 SDK
- `gmail/` — Gmail OAuth token management + email classification
- `extractors/jobspy.ts` — HTTP client for the Python FastAPI sidecar
- `rxresume/client.ts` — RxResume API client

### SvelteKit Routes (`src/routes/`)

- `(app)/` — SSR pages with `+page.server.ts` loading data via the server-side tRPC caller
- `api/trpc/[trpc]/+server.ts` — tRPC HTTP adapter
- `api/pipeline/stream/+server.ts` — SSE endpoint for real-time pipeline progress (EventEmitter-based)
- `oauth/gmail/callback/+server.ts` — Gmail OAuth redirect handler
- `pdfs/[jobId]/+server.ts` — Redirects to the public DO Spaces CDN URL
- `health/+server.ts` — Liveness probe (`{ ok: true }`)

### Database (`src/lib/server/db/index.ts`)

`getPrisma()` returns a singleton `PrismaClient`. In tests, use `createTestClient(url)` to inject a URL pointing at the in-memory replica set.

**Prisma v6 lock:** Do not upgrade to v7 — `@prisma/adapter-mongodb` is unpublished for v7. See `issues-log.md` ISSUE-001.

### Migration Progress

| Phase | Name | Status | Completed |
|---|---|---|---|
| 1–6 | Data Model → SvelteKit Scaffold | ✅ COMPLETE (MVP gate) | 2026-04-03 |
| 7 | Jobs Pages | ✅ COMPLETE | 2026-04-03 |
| 8 | Settings Page | ✅ COMPLETE | 2026-04-03 |
| 9 | Pipeline SSE | ✅ COMPLETE | 2026-04-03 |
| 10 | PDF Generation | ✅ COMPLETE | 2026-04-03 |
| 11 | Gmail Tracking | ✅ COMPLETE | 2026-04-03 |
| 12 | CI Pipeline | ⚪ NOT STARTED | — |

Full phase tracking in `Status.md`.

## Environment Variables

Required at runtime (see `.env.example` for full list):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MongoDB connection string |
| `DO_SPACES_ENDPOINT` / `KEY` / `SECRET` / `BUCKET` | PDF storage |
| `LLM_API_KEY` / `MODEL` | AI job scoring |
| `RXRESUME_URL` / `EMAIL` / `PASSWORD` | PDF generation |
| `EXTRACTOR_URL` | Python sidecar (default: `http://localhost:8000`) |

Gmail OAuth (`GMAIL_OAUTH_CLIENT_ID`, `_SECRET`, `_REDIRECT_URI`) is required only for email tracking.
