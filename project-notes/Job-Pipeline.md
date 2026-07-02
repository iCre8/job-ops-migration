# Job Pipeline Review

## Findings

### High: Cancel does not cancel the active pipeline

In `apps/web`, `cancel` only updates the `PipelineRun` row to `failed` with `"Cancelled by user"` in `apps/web/src/lib/server/trpc/routers/pipeline.ts`. The running `runPipelineOrchestrator` never reads that row or checks a cancel flag during discovery, scoring, or processing. The original keeps in-memory run state, sets `cancelRequestedAt`, and checks `ensureNotCancelled()` between stages and inside step callbacks. Result: users see "cancelled/failed" while work can continue mutating jobs.

### High: Migrated web pipeline is JobSpy-only

`apps/web` imports only `scrapeJobSpy` and defaults to JobSpy sites `linkedin`, `indeed`, and `glassdoor`. The original validates selected sources against the extractor registry, location capabilities, watchlist filters, and runtime source availability before running. It then calls `discoverJobsStep` with source selection and watchlist options. This drops Gradcracker, UKVisaJobs, Adzuna, Watchlist, and source capability behavior.

### Medium: Progress/state API is thinner than original

`apps/web` emits string events only: `start`, `progress`, `complete`, and `error`, with basic counts. The original exposes current status, progress snapshot, SSE heartbeat, structured per-stage counters, challenge state, and LLM configuration-required state. If the page reloads during a run, the Svelte page cannot reconstruct current progress from a snapshot; it only listens to future events after trigger.

### Medium: Challenge and LLM-config pause/resume behavior is missing

The original can pause for Cloudflare challenges, expose pending challenges, launch a viewer, solve, and retry challenged sources. It also pauses/resumes when LLM config is missing. `apps/web` silently default-scores when no LLM key exists and has no challenge endpoints.

### Medium: Run history lacks original details/insights

`apps/web` persists a `PipelineRun`, but only stores broad counts and metadata. The original stores config snapshots, saved details, result summary, and exposes run insights. This makes previous-run inspection materially less useful.

## Summary

The migrated `apps/web` pipeline is not mock-only; it does start a background run, persists a run record, imports jobs, scores, processes, and streams progress. But it is a simplified pipeline, not parity with the original orchestration flow.

Recommended priority:

1. Implement real cancellation.
2. Restore source/extractor registry parity.
3. Restore structured progress snapshots and challenge handling.
4. Restore richer run history and insights.
