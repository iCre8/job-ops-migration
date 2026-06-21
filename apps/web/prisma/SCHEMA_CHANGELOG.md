# SCHEMA_CHANGELOG.md
# Prisma MongoDB Schema Change Log

> **Rule:** Every schema change must be recorded here BEFORE running `prisma db push`.
> Include the date, a description of the change, and the reason.
> This file is the migration history for the MongoDB schema.

---

## How to apply a schema change

```bash
# 1. Edit prisma/schema.prisma
# 2. Record the change below (this file)
# 3. Commit both files together
# 4. Apply the change
cd job-ops-migration/apps/web
npx prisma db push
npx prisma generate
```

---

## Changelog

### 2026-03-31 — Initial schema

**Author:** Migration — Phase 1
**Change:** Initial schema creation from legacy SQLite/Drizzle schema.

**Collections created:**
- `jobs` — Main job listing entity with embedded `StageEvent[]`, `ApplicationTask[]`,
  `InterviewRecord[]`, `TracerLink[]`
- `tracer_click_events` — Click analytics for tracer links (separate collection due to
  unbounded volume)
- `pipeline_runs` — Pipeline execution audit trail
- `chat_threads` — AI chat threads per job, with embedded `ChatMessage[]`
- `chat_runs` — Chat execution audit (token usage, status)
- `settings` — Singleton settings document
- `post_application_integrations` — Gmail OAuth credentials with embedded `SyncRun[]`
- `post_application_messages` — Synced inbox emails (separate collection — unbounded)

**Embedded types created:**
- `StageEvent` — Application stage history
- `ApplicationTask` — Prep tasks / reminders
- `InterviewRecord` — Interview scheduling and outcomes
- `TracerLink` — PDF tracer link tokens
- `ChatMessage` — Individual AI chat messages
- `SyncRun` — Email sync run metadata

**Design decisions:**
- `tasks`, `interviews`, and `stageEvents` embedded in `Job` (bounded size, always
  queried with job). Replaces separate SQLite tables that always required a JOIN.
- `tracerLinks` embedded in `Job` (tight 1:1 relationship, max ~5 links per job).
- `TracerClickEvent` kept separate (analytics volume is unbounded).
- `ChatMessage` embedded in `ChatThread` (always fetched with thread, bounded by
  conversation length).
- `SyncRun` embedded in `PostApplicationIntegration` (bounded history per provider).
- `Settings` uses a string `@id` set to `"singleton"` by application code — enforces
  the single-document invariant without a unique index.
- `onDelete` referential actions are NOT used — MongoDB connector does not enforce them.
  Cascades handled in application code.

---
