# build-process.md
# Job-Ops Migration — Build Process & Governance

> **Reference documents:**
> - Architecture decisions and full schemas: `application-plan.md`
> - Modularity enhancements for legacy stack: `Modularity-Enhancement.md`
> - How to use these documents: `Init-instruction.md`
> - Living progress tracker: `job-ops-migration/Status.md`
> - Issue tracking: `job-ops-migration/issues-log.md`

---

## 1. Project Summary

Migrate Job-Ops from a React/Express/SQLite monolith to a SvelteKit SSR application backed
by MongoDB (self-hosted), tRPC, and DigitalOcean Spaces for PDF storage. The Python jobspy
extractor is retained as an HTTP sidecar. All new code lives in `job-ops-migration/`. Legacy
code at the repo root is read-only reference material.

**Stack:**

| Layer | Technology |
|---|---|
| Frontend | SvelteKit 2 + Svelte 5, adapter-node, SSR |
| API | tRPC v11 (end-to-end type safety) |
| Database | MongoDB 7 (Docker Compose), Prisma v7 (`db push`) |
| Object storage | DigitalOcean Spaces (AWS S3 SDK compatible) |
| UI components | shadcn-svelte + Tailwind CSS v4 |
| Extractor | Python jobspy wrapped in FastAPI HTTP sidecar |
| Unit/Integration tests | Vitest 2 + mongodb-memory-server |
| E2E tests | Playwright |
| Linting | ESLint 9 (flat config) + svelte-check |
| Node version | 22 (locked via Volta) |

---

## 2. MVP Definition

**MVP = Phases 1–6.** These phases deliver a working job discovery, scoring, and management
loop on the new stack. PDF generation, Gmail tracking, and the full E2E suite are post-MVP.

| Phase | Scope | MVP? |
|---|---|---|
| 1 | Data model (Prisma schema + MongoDB) | ✅ MVP |
| 2 | Infrastructure (Docker Compose, DO Spaces config) | ✅ MVP |
| 3 | Storage service (DOSpacesProvider + interface) | ✅ MVP |
| 4 | tRPC routers (jobs, settings, pipeline) | ✅ MVP |
| 5 | Python extractor sidecar (FastAPI + Node client) | ✅ MVP |
| 6 | SvelteKit scaffold (layout, routing, auth hooks) | ✅ MVP |
| 7 | Jobs page + Job detail page | Post-MVP |
| 8 | Settings page | Post-MVP |
| 9 | Pipeline SSE + progress UI | Post-MVP |
| 10 | PDF generation + DO Spaces upload | Post-MVP |
| 11 | Post-application / Gmail tracking | Post-MVP |
| 12 | Full E2E suite + CI pipeline | Post-MVP |

---

## 3. Phase Gate Policy

### Gate Types

**Hard Gate** — The next phase cannot begin until the current phase passes all thresholds.
A failed hard gate must be logged in `issues-log.md` with a full RCA before any remediation
work starts.

**Soft Gate** — Failure is logged in `issues-log.md`. Work on the next phase may begin with
a documented exception recorded in `Status.md`. The exception must be resolved before the
phase is marked `COMPLETE`.

### Gate Assignments

| Phase | Gate Type | Reason |
|---|---|---|
| 1 — Data model | **Hard** | Schema errors corrupt all downstream work |
| 2 — Infrastructure | **Hard** | Broken infra blocks all integration tests |
| 3 — Storage service | **Hard** | PDF pipeline depends on this interface |
| 4 — tRPC routers | **Hard** | All frontend data flows through tRPC |
| 5 — Extractor sidecar | **Hard** | Pipeline core path |
| 6 — SvelteKit scaffold | **Hard** | MVP gate — all above must be solid |
| 7 — Jobs pages | Soft | UI can iterate |
| 8 — Settings page | Soft | UI can iterate |
| 9 — Pipeline SSE | Soft | UX enhancement |
| 10 — PDF generation | **Hard** | Storage + external API contract |
| 11 — Gmail tracking | Soft | OAuth can be brittle in test env |
| 12 — CI pipeline | **Hard** | Deployment gate |

### Test Score Thresholds

All phases must meet **both** thresholds to pass their gate:

| Test type | Threshold |
|---|---|
| Unit test line coverage (Vitest `--coverage`) | **≥ 80%** across phase-relevant `src/lib/` files |
| Integration test pass rate | **100%** — zero failures, zero skipped |
| E2E pass rate (Playwright) | **100%** of written specs — no failures permitted |

> **Coverage scope:** Only files added or modified in the current phase count toward the
> 80% threshold. Pre-existing files are excluded unless modified.

### Checking Thresholds

```bash
# Unit + integration (coverage report)
cd job-ops-migration/apps/web
npx vitest run --coverage

# E2E (requires running stack)
npx playwright test
```

Pass criteria from CI output:
- Vitest: `All test files passed` + coverage table shows ≥ 80% Lines for in-scope files
- Playwright: `X passed (X)` with zero failures

---

## 4. RACI Cards

### Roles

| Role | Description |
|---|---|
| **Product Owner (PO)** | Owns feature scope, acceptance criteria, and phase-gate approval decisions |
| **Backend Developer (BE)** | Responsible for server-side implementation (tRPC, services, Prisma, SSE) |
| **Frontend Developer (FE)** | Responsible for SvelteKit routes, Svelte components, client tRPC |
| **DevOps Engineer (DevOps)** | Responsible for Docker Compose, CI pipeline, DO Spaces configuration |
| **QA Engineer (QA)** | Responsible for writing and validating test suites, reviewing coverage reports |
| **Claude Code (CC)** | Implements code as directed, proposes architecture, flags issues |

> On a solo project all human roles map to one person. The column structure is preserved
> for team growth. **Accountable (A) always belongs to a human role, never to Claude Code.**

### R = Responsible, A = Accountable, C = Consulted, I = Informed

#### Feature: Data Model & Schema

| Task | PO | BE | FE | DevOps | QA | CC |
|---|---|---|---|---|---|---|
| Define MongoDB collection strategy | A | C | I | I | I | C |
| Write Prisma schema | I | A | C | I | C | R |
| Run `prisma db push` | I | A | I | C | I | R |
| Write integration tests for CRUD | I | C | I | I | A | R |
| Review and approve schema | A | C | I | I | I | I |

#### Feature: Infrastructure (Docker Compose + DO Spaces)

| Task | PO | BE | FE | DevOps | QA | CC |
|---|---|---|---|---|---|---|
| Write docker-compose.yml | I | C | I | A | I | R |
| Configure DO Spaces bucket | I | I | I | A | I | R |
| Write `.env.example` | I | C | I | A | I | R |
| Verify health checks | I | I | I | A | C | R |
| Document infra setup in README | I | I | I | A | I | R |

#### Feature: Storage Service (DOSpacesProvider)

| Task | PO | BE | FE | DevOps | QA | CC |
|---|---|---|---|---|---|---|
| Define `StorageProvider` interface | I | A | C | I | C | R |
| Implement `DOSpacesProvider` | I | A | I | C | I | R |
| Write unit tests (mock S3) | I | C | I | I | A | R |
| Write integration tests (real upload) | I | C | I | C | A | R |
| Review implementation | I | A | I | C | C | I |

#### Feature: tRPC Routers

| Task | PO | BE | FE | DevOps | QA | CC |
|---|---|---|---|---|---|---|
| Define router structure | I | A | C | I | I | R |
| Implement `jobs` router | C | A | C | I | C | R |
| Implement `settings` router | C | A | C | I | C | R |
| Implement `pipeline` router | C | A | C | I | C | R |
| Write unit tests per router | I | C | I | I | A | R |
| Write integration tests | I | C | I | I | A | R |
| Review and approve API contracts | A | C | C | I | C | I |

#### Feature: Python Extractor Sidecar

| Task | PO | BE | FE | DevOps | QA | CC |
|---|---|---|---|---|---|---|
| Write FastAPI wrapper | I | A | I | C | I | R |
| Adapt `scrape_jobs.py` | I | A | I | I | I | R |
| Write Node HTTP client | I | A | I | I | C | R |
| Integration test: POST /scrape | I | C | I | C | A | R |
| Containerise extractor | I | I | I | A | C | R |

#### Feature: SvelteKit Scaffold (MVP Gate)

| Task | PO | BE | FE | DevOps | QA | CC |
|---|---|---|---|---|---|---|
| Setup svelte.config.js + adapter-node | I | C | A | C | I | R |
| Setup ESLint + svelte-check | I | C | A | C | C | R |
| Write root layout + app shell | C | I | A | I | C | R |
| Wire tRPC client | I | C | A | I | C | R |
| Write hooks.server.ts (request ID) | I | A | C | I | C | R |
| Write health route | I | A | I | C | I | R |
| Playwright smoke tests | I | I | C | I | A | R |

#### Feature: Jobs Pages (Post-MVP)

| Task | PO | BE | FE | DevOps | QA | CC |
|---|---|---|---|---|---|---|
| Jobs list page (SSR load + reactive) | C | I | A | I | C | R |
| Job detail page | C | I | A | I | C | R |
| JobCard component | I | I | A | I | C | R |
| Download PDF link | C | C | A | I | C | R |
| Playwright: list + detail specs | I | I | C | I | A | R |

#### Feature: Pipeline SSE (Post-MVP)

| Task | PO | BE | FE | DevOps | QA | CC |
|---|---|---|---|---|---|---|
| Event emitter architecture | I | A | C | I | I | R |
| SSE stream route | I | A | C | I | C | R |
| Progress UI component | I | C | A | I | C | R |
| Vitest: emitter unit tests | I | C | I | I | A | R |
| Playwright: progress bar spec | I | I | C | I | A | R |

#### Feature: PDF Generation + DO Spaces Upload (Post-MVP)

| Task | PO | BE | FE | DevOps | QA | CC |
|---|---|---|---|---|---|---|
| Port RxResume service | I | A | I | I | I | R |
| Integrate StorageProvider | I | A | I | C | C | R |
| Signed URL redirect route | I | A | C | I | C | R |
| Integration test: generate → upload → URL | I | C | I | C | A | R |

#### Feature: Gmail / Post-Application Tracking (Post-MVP)

| Task | PO | BE | FE | DevOps | QA | CC |
|---|---|---|---|---|---|---|
| OAuth flow (start + callback) | C | A | C | C | C | R |
| Email classification service | C | A | I | I | C | R |
| Sync run orchestration | I | A | I | I | C | R |
| Inbox review UI | C | I | A | I | C | R |
| Unit: email classifier | I | C | I | I | A | R |

#### Feature: CI Pipeline (Post-MVP)

| Task | PO | BE | FE | DevOps | QA | CC |
|---|---|---|---|---|---|---|
| GitHub Actions lint job | I | C | C | A | C | R |
| GitHub Actions test job | I | C | C | A | C | R |
| GitHub Actions E2E job | I | C | C | A | C | R |
| Confirm all gates pass in CI | A | C | C | C | C | I |

---

## 5. CRC Cards (Service Level)

> **Format:** Name | Responsibilities | Collaborators

---

### `PrismaClient` (singleton)
**Responsibilities:**
- Provide a single shared Prisma client instance to all server-side code
- Connect to MongoDB on startup, disconnect on shutdown
- Expose typed model accessors (`prisma.job`, `prisma.settings`, etc.)

**Collaborators:** All tRPC routers, all services, integration test setup

---

### `StorageProvider` + `DOSpacesProvider`
**Responsibilities:**
- Write a readable stream to DO Spaces under a given key
- Check existence of a stored object
- Delete a stored object
- Return a short-lived signed download URL
- Return a public CDN URL (when CDN is configured)

**Collaborators:** `PDF Generation Service`, `PDF download route (/pdfs/[jobId])`, integration tests

---

### `LLMProvider` + `LLMProviderFactory`
**Responsibilities:**
- Abstract over OpenRouter / OpenAI / Gemini API differences
- Accept a prompt and return a completed string
- Accept a prompt and return an async iterable for streaming
- Resolve the active provider from `Settings`

**Collaborators:** `Job Scoring Service`, `Tailoring Service`, `Chat Service`, `Project Selection Service`

---

### `JobsRouter` (tRPC)
**Responsibilities:**
- List jobs with pagination and status filter
- Retrieve a single job by ID
- Update mutable job fields (status, stage, notes)
- Dispatch bulk actions (rescore, skip, delete, move_to_ready)
- Trigger PDF generation for a single job
- Add a manually created job

**Collaborators:** `PrismaClient`, `Pipeline Orchestrator`, `PDF Generation Service`, SvelteKit load functions, client-side tRPC hook

---

### `SettingsRouter` (tRPC)
**Responsibilities:**
- Read the singleton `Settings` document
- Write updated settings values (partial update)
- Validate settings against a Zod schema before persisting
- Expose resolved defaults when a setting is unset

**Collaborators:** `PrismaClient`, `LLMProviderFactory`, `RxResume Service`, `ExtractorClient`

---

### `PipelineRouter` (tRPC)
**Responsibilities:**
- Trigger a manual pipeline run
- Return current pipeline run status
- Return paginated pipeline run history
- Accept inbound webhook trigger (n8n / scheduler)

**Collaborators:** `PrismaClient`, `Pipeline Orchestrator`, SSE event emitter

---

### `Pipeline Orchestrator`
**Responsibilities:**
- Coordinate the discover → score → tailor → PDF lifecycle
- Invoke `ExtractorClient` to fetch raw jobs
- Deduplicate jobs against the database
- Invoke `Job Scoring Service` per discovered job
- Update job statuses at each lifecycle transition
- Emit progress events to the SSE event emitter
- Record `PipelineRun` documents

**Collaborators:** `ExtractorClient`, `Job Scoring Service`, `Tailoring Service`, `PrismaClient`, SSE event emitter, `PipelineRouter`

---

### `ExtractorClient`
**Responsibilities:**
- Send a POST /scrape request to the Python sidecar with search configuration
- Deserialise and validate the response as `RawJob[]`
- Apply a configurable timeout and retry on transient failure
- Log errors with enough context for RCA

**Collaborators:** Python extractor sidecar (HTTP), `Pipeline Orchestrator`, `SettingsRouter` (reads extractor config)

---

### `Job Scoring Service`
**Responsibilities:**
- Build a scoring prompt from the job description and resume profile
- Send to `LLMProvider` and parse a structured score response
- Return `{ scoreOverall, scoreReasoning }`
- Never log the full prompt or raw LLM response body

**Collaborators:** `LLMProviderFactory`, `SettingsRouter` (reads model config and resume profile)

---

### `Tailoring Service`
**Responsibilities:**
- Build a tailoring prompt from the job description and resume profile
- Return tailored `{ summary, headline, skills[] }`
- Select relevant projects via `Project Selection Service`
- Record a `GhostwriterRun` for audit

**Collaborators:** `LLMProviderFactory`, `Project Selection Service`, `PrismaClient`, `SettingsRouter`

---

### `PDF Generation Service`
**Responsibilities:**
- Accept `jobId`, retrieve tailored content from DB
- Import a temporary resume to RxResume (v4 or v5)
- Request a PDF export URL from RxResume
- Stream the PDF to `StorageProvider` under key `resume_{jobId}.pdf`
- Update job record with `pdfStorageKey` and `pdfPublicUrl`
- Delete the temporary RxResume record after download

**Collaborators:** `PrismaClient`, `StorageProvider`, RxResume API (external), `SettingsRouter`

---

### `Post-Application Service`
**Responsibilities:**
- Manage Gmail OAuth flow (start → exchange → refresh)
- Persist encrypted tokens in `PostApplicationIntegration`
- Fetch new emails since last sync
- Classify each email (interview invite, rejection, offer, other) via `LLMProvider`
- Create `PostApplicationMessage` records for inbox review
- Record `SyncRun` metadata

**Collaborators:** `LLMProviderFactory`, `PrismaClient`, Google OAuth API (external), `PostApplicationRouter`

---

### `Tracer Service`
**Responsibilities:**
- Generate unique tokens for tracer links embedded in PDFs
- Record click events (`TracerClickEvent`) on token hit
- Aggregate click analytics per job and link
- Return analytics data to the `TracerRouter`

**Collaborators:** `PrismaClient`, PDF download route, `TracerRouter`

---

### `Auth Middleware` (`hooks.server.ts`)
**Responsibilities:**
- Inject a `requestId` (honour inbound `x-request-id` or generate one) into every request
- Enforce Basic Auth on write routes when `BASIC_AUTH_USER` is configured
- Pass `requestId` into tRPC context for logging and response meta

**Collaborators:** All tRPC routes, all `+server.ts` routes, `Logger`

---

### `Logger` (`infra/logger.ts`)
**Responsibilities:**
- Provide structured JSON logging (wraps `pino` or equivalent)
- Redact sensitive fields before any log write: `authorization`, `cookie`, `password`, `secret`, `token`, `apiKey`
- Accept context fields: `requestId`, `jobId`, `pipelineRunId`
- Never accept raw upstream response bodies or full webhook payloads

**Collaborators:** All services, all routers, `Auth Middleware`

---

## 6. Phase-by-Phase Plan

> Each phase lists: goal, files to create, test requirements, and gate type.

---

### Phase 1 — Data Model
**Goal:** Prisma v7 schema pushed to a running MongoDB. All collections verifiable via integration tests.

**Deliverables:**
- `job-ops-migration/apps/web/prisma/schema.prisma` (from `application-plan.md` Phase 1)
- `job-ops-migration/apps/web/prisma/SCHEMA_CHANGELOG.md`
- `job-ops-migration/apps/web/src/lib/server/db/index.ts` (Prisma client singleton)
- `tests/integration/db/schema.test.ts` (CRUD on all collections)

**Test requirements:**
- Integration: create/read/update/delete one document in each collection
- Integration: embedded type arrays (stageEvents, tasks, interviews, tracerLinks) round-trip correctly
- Coverage gate: 100% of `src/lib/server/db/index.ts` covered

**Gate: HARD**

**Commands:**
```bash
cd job-ops-migration/apps/web
npx prisma db push
npx vitest run tests/integration/db/
```

---

### Phase 2 — Infrastructure
**Goal:** `docker-compose.yml` runs all three services (mongo, web, extractor) with health checks passing.

**Deliverables:**
- `job-ops-migration/docker-compose.yml`
- `job-ops-migration/.env.example`
- `job-ops-migration/apps/web/src/routes/health/+server.ts`
- `job-ops-migration/services/extractor/Dockerfile`

**Test requirements:**
- Integration: `GET /health` returns `{ ok: true }` with a running stack
- Manual smoke: `docker compose up` → all three containers healthy within 60s

**Gate: HARD**

---

### Phase 3 — Storage Service
**Goal:** `DOSpacesProvider` implements `StorageProvider` interface. Unit and integration tests pass.

**Deliverables:**
- `src/lib/server/services/storage/provider.ts`
- `src/lib/server/services/storage/do-spaces.ts`
- `src/lib/server/services/storage/index.ts`
- `tests/unit/services/storage.test.ts` (mock S3 client)
- `tests/integration/services/storage.test.ts` (real DO Spaces or localstack)

**Test requirements:**
- Unit: `write`, `exists`, `delete`, `signedDownloadUrl` all tested against mock `S3Client`
- Integration: upload a real file, verify `exists()` returns true, fetch signed URL, delete
- Coverage gate: ≥ 80% lines in `storage/`

**Gate: HARD**

---

### Phase 4 — tRPC Routers
**Goal:** All MVP routers (jobs, settings, pipeline) implemented, tested, and callable via tRPC fetch handler.

**Deliverables:**
- `src/lib/server/trpc/init.ts`
- `src/lib/server/trpc/context.ts`
- `src/lib/server/trpc/routers/jobs.ts`
- `src/lib/server/trpc/routers/settings.ts`
- `src/lib/server/trpc/routers/pipeline.ts`
- `src/lib/server/trpc/routers/_app.ts`
- `src/routes/api/trpc/[trpc]/+server.ts`
- `tests/unit/trpc/jobs.test.ts`
- `tests/unit/trpc/settings.test.ts`
- `tests/unit/trpc/pipeline.test.ts`
- `tests/integration/trpc/jobs.test.ts` (in-memory MongoDB)

**Test requirements:**
- Unit: every procedure tested with mocked Prisma (happy path + error path)
- Integration: `jobs.list`, `jobs.byId`, `jobs.update`, `settings` round-trips against in-memory Mongo
- Coverage gate: ≥ 80% lines in `trpc/routers/`

**Gate: HARD**

---

### Phase 5 — Python Extractor Sidecar
**Goal:** FastAPI sidecar containerised and responding to POST /scrape. Node client tested.

**Deliverables:**
- `job-ops-migration/services/extractor/http_server.py`
- `job-ops-migration/services/extractor/scrape_jobs.py` (adapted)
- `job-ops-migration/services/extractor/requirements.txt`
- `job-ops-migration/services/extractor/Dockerfile`
- `src/lib/server/extractors/jobspy.ts`
- `tests/unit/extractors/jobspy.test.ts` (mock fetch)
- `tests/integration/extractors/jobspy.test.ts` (live sidecar via Docker)

**Test requirements:**
- Unit: Node client handles 200, 500, and timeout correctly
- Integration: POST /scrape with valid params returns an array of shaped jobs
- Coverage gate: ≥ 80% lines in `extractors/`

**Gate: HARD**

---

### Phase 6 — SvelteKit Scaffold (MVP Gate)
**Goal:** SvelteKit app boots, serves `/health`, app shell renders, tRPC client wired. All MVP phases passing. This is the MVP gate.

**Deliverables:**
- `apps/web/svelte.config.js`
- `apps/web/vite.config.ts`
- `apps/web/eslint.config.js`
- `apps/web/tsconfig.json`
- `apps/web/src/app.html`
- `apps/web/src/app.d.ts`
- `apps/web/src/hooks.server.ts` (requestId injection, basic auth)
- `apps/web/src/routes/(app)/+layout.svelte`
- `apps/web/src/routes/(app)/+layout.server.ts`
- `apps/web/src/lib/trpc/client.ts`
- `tests/e2e/scaffold.spec.ts`

**Test requirements:**
- ESLint: zero errors across all files added in Phases 1–6
- svelte-check: zero type errors
- Playwright: `/health` returns 200, app shell loads without console errors
- All Phase 1–5 test suites still passing (regression check)
- Coverage gate: ≥ 80% lines in `hooks.server.ts`, `lib/trpc/client.ts`

**Gate: HARD — this is the MVP gate. All prior gates must be green.**

---

### Phase 7 — Jobs Pages
**Gate: SOFT**

**Deliverables:** Jobs list page, job detail page, `JobCard` component, PDF download link.

**Test requirements:**
- Playwright: list renders ≥ 1 job from seeded DB, detail page opens, download link present
- Coverage: ≥ 80% in any new `lib/` code (not Svelte components)

---

### Phase 8 — Settings Page
**Gate: SOFT**

**Deliverables:** Settings page, settings form components, save round-trip via tRPC.

**Test requirements:**
- Playwright: settings page loads, form submits successfully, value persists on reload

---

### Phase 9 — Pipeline SSE + Progress UI
**Gate: SOFT**

**Deliverables:** SSE stream route, event emitter, progress bar component.

**Test requirements:**
- Vitest: event emitter emits `progress`, `complete`, `error` in correct sequence
- Playwright: trigger pipeline → progress bar appears and completes

---

### Phase 10 — PDF Generation + DO Spaces Upload
**Gate: HARD**

**Deliverables:** Ported RxResume service, `generateFinalPdf` function using `StorageProvider`, signed URL redirect route.

**Test requirements:**
- Integration: generate PDF → upload to DO Spaces → signed URL resolves to downloadable file
- Coverage: ≥ 80% in `services/pdf/`

---

### Phase 11 — Post-Application / Gmail Tracking
**Gate: SOFT**

**Deliverables:** OAuth flow, email classifier, sync run, inbox review UI.

**Test requirements:**
- Unit: email classifier correctly labels a fixture set of email subjects
- Playwright: OAuth callback page renders without error (mock OAuth provider)

---

### Phase 12 — CI Pipeline
**Gate: HARD**

**Deliverables:** GitHub Actions workflows for lint, test, E2E.

**Test requirements:**
- All 12 phases' test suites pass in CI on a clean checkout
- Coverage report uploaded as artifact
- Zero lint errors
- Zero svelte-check errors

---

## 7. Definition of Done

A phase is **COMPLETE** when:

1. All deliverables listed for the phase exist and are committed
2. Unit and integration test coverage for in-scope files ≥ 80%
3. All integration tests pass (0 failures, 0 skipped)
4. All E2E Playwright specs for the phase pass (100%)
5. ESLint reports zero errors
6. `svelte-check` reports zero type errors
7. `Status.md` is updated to reflect the phase completion
8. Any issues discovered during the phase are logged in `issues-log.md` with RCA

---

## 8. Commands Reference

```bash
# From job-ops-migration/apps/web/

# Schema
npx prisma db push
npx prisma generate

# Dev server
npm run dev

# Lint
npm run lint
npm run check          # svelte-check + tsc

# Unit + integration tests
npx vitest run --coverage

# Single test file
npx vitest run tests/unit/trpc/jobs.test.ts

# E2E
npx playwright test
npx playwright test tests/e2e/jobs.spec.ts  # single spec

# From job-ops-migration/
docker compose up -d
docker compose logs -f web
docker compose down
```
