# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Job-Ops Migration is migrating a self-hosted job application orchestrator from React/Express to SvelteKit. The app scrapes job boards, scores jobs with AI, generates tailored PDFs via RxResume, and tracks application emails via Gmail OAuth.

**Monorepo layout:**
- `apps/web/` — **Active app (SvelteKit).** SvelteKit 2 + Svelte 5, tRPC v11, MongoDB 7 + Prisma v6. Full feature parity complete as of 2026-06-21.
- `orchestrator/` — **Legacy app (React).** React 18 + Vite + Express 4 + PostgreSQL/Drizzle. Retained for reference; not actively developed.
- `shared/` — Types and utilities shared across packages.
- `career-boards/*`, `extractors/*` — Job board and extraction integrations.

**All active development happens in `apps/web/`.**

## Development Commands

All commands run from `apps/web/` unless noted.

```bash
# SvelteKit dev server (:5173) — MongoDB must be running first
pnpm dev

# MongoDB (start before pnpm dev) — compose file is in apps/web/
docker compose up -d          # starts mongo + runs mongo-init (replica set init)

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

MongoDB must be running before `pnpm dev`. The `apps/web/docker-compose.yml` starts a no-auth single-node replica set (required for Prisma transactions):

```bash
cd apps/web && docker compose up -d
```

The `mongo-init` service auto-runs `rs.initiate()` on first start. Set `DATABASE_URL` in the repo root `.env`:
```
DATABASE_URL=mongodb://localhost:27017/jobops?directConnection=true
```

All other services (DO Spaces, RxResume, Gmail OAuth, Python extractor sidecar) are optional for basic UI work but required for full pipeline runs.

Integration tests use `MongoMemoryReplSet` (not `MongoMemoryServer`) — Prisma's `deleteMany()` requires a replica set for transactions. No external DB needed for tests.

## Architecture (apps/web — SvelteKit migration target)

### tRPC Routers (`src/lib/server/trpc/routers/`)

All API logic lives here. Each router groups `query` and `mutation` procedures:

- `auth.ts` — `bootstrapStatus`, `setup`, `login`, `logout`, `me`, `listUsers`, `createUser`, `toggleUserDisabled`
- `jobs.ts` — CRUD, `markApplied` (not `apply` — reserved word), `verify`, `delete`, `moveStage`, notes CRUD, documents CRUD, `generatePdf`
- `pipeline.ts` — `trigger`, `cancel`, `list`, `byId`; nested `searchPresets` router (list/create/update/delete/markUsed)
- `chat.ts` — `threads.list/create/reset/delete`, `sendMessage` (creates `ChatRun`, returns `runId` for SSE)
- `tracking.ts` — Gmail sync, OAuth token refresh, integration management
- `watchlist.ts` — `sources.list/upsert/toggle/delete`; `Prisma.InputJsonObject` cast for `config` field
- `tracer.ts` — `analytics`, `jobClicks`
- `designResume.ts` — `list`, `get`, `update`, `exportPdfUrl` (proxies RxResume API)
- `settings.ts` — App configuration persisted in MongoDB
- `_app.ts` — Root router combining all sub-routers

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
