# Init-instruction.md
# How to Use the Job-Ops Migration Documents

These instructions are for both the developer and Claude Code. Read this at the start of
every work session before touching any code.

---

## Document Map

| Document | Location | Purpose | Update frequency |
|---|---|---|---|
| `build-process.md` | repo root | Master plan — phases, gates, RACI, CRC | Rarely (only when scope changes) |
| `application-plan.md` | repo root | Full architecture — schemas, code examples | Rarely (reference only) |
| `Modularity-Enhancement.md` | repo root | Enhancements for legacy stack | As enhancements are implemented |
| `Init-instruction.md` | repo root | This file — how to operate | Rarely |
| `Status.md` | `job-ops-migration/` | Living progress tracker | Every session start + after each task |
| `issues-log.md` | `job-ops-migration/` | Issue tracking with RCA | Whenever an issue is found |

---

## Session Start Checklist

At the start of every Claude Code session, before writing a single line of code:

1. **Read `Status.md`** — identify the current phase and any open blockers
2. **Read `issues-log.md`** — check for any unresolved P1-Critical issues; these must be
   addressed before new feature work
3. **Read the current phase section** in `build-process.md` — review deliverables and test
   requirements
4. **Update `Status.md`** — set `Last Updated` to today's date, confirm the current phase
   is correctly reflected
5. **Check the gate status** — if the previous phase's gate has not been formally recorded
   as PASSED in `Status.md`, do not proceed to the next phase

---

## How to Use `build-process.md`

### Reading the document

- **Section 2 (MVP Definition)** — quick reference for what must ship first
- **Section 3 (Phase Gate Policy)** — the rules for when a phase is complete
- **Section 4 (RACI Cards)** — who is responsible for what; consult before starting any task
- **Section 5 (CRC Cards)** — what each service does and who it talks to; read this before
  implementing or modifying any service
- **Section 6 (Phase-by-Phase Plan)** — the authoritative list of files to create and tests
  to write for each phase

### When to modify `build-process.md`

Only modify this document when:
- The project scope changes (new feature added, phase removed)
- A RACI role changes (team member added, responsibility shifts)
- A CRC card's responsibilities change due to a design decision
- A phase gate threshold is formally changed (requires Product Owner approval)

Do **not** use `build-process.md` to record progress or issues — that belongs in
`Status.md` and `issues-log.md`.

---

## How to Use `Status.md`

### Structure

`Status.md` contains:
- **Current Phase** — the phase actively being worked on
- **Phase Table** — status of all 12 phases (`NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `COMPLETE`)
- **Open Exceptions** — soft-gate exceptions that have been granted but not yet resolved
- **Last Session Summary** — what was done in the previous session
- **Current Session Tasks** — what is being worked on now

### Update rules

**Claude Code must update `Status.md`:**
- At the **start of every session** — verify the current phase, confirm no status is stale
- After **completing each deliverable** — mark the specific file/task as done
- After **a phase gate is passed** — update the phase row to `COMPLETE` and record
  test scores
- After **a phase gate fails** — update the phase row to `BLOCKED`, record the failure reason,
  and log the issue in `issues-log.md`

### Phase status values

| Value | Meaning |
|---|---|
| `NOT STARTED` | No work has begun |
| `IN PROGRESS` | Active development |
| `GATE PENDING` | All deliverables complete; awaiting test run and gate check |
| `BLOCKED` | Gate failed or dependency unresolved; see issues-log.md |
| `COMPLETE` | Gate passed; test scores recorded |

### Recording a gate result

When a phase gate is checked, add the following to the phase row:

```
| Phase 1 | COMPLETE | Unit: 94% | Integration: 100% (12/12) | E2E: N/A | 2026-04-02 |
```

---

## How to Use `issues-log.md`

### When to create a new issue

Create an issue entry whenever:
- A test fails and the cause is not immediately obvious
- A gate threshold is not met
- An external service (RxResume, DO Spaces, MongoDB, Python sidecar) behaves unexpectedly
- A design decision made in `application-plan.md` proves unworkable in practice
- A dependency version conflict or breaking change is discovered

Do **not** create issues for normal in-progress work (e.g., a test that fails before the
feature is implemented).

### Severity definitions

| Severity | Definition | Action |
|---|---|---|
| **P1-Critical** | Blocks current phase gate; prevents forward progress | Must be resolved before any other work; escalate immediately |
| **P2-Major** | Degrades a feature significantly but work can continue | Resolve within the current phase; log exception in `Status.md` if deferred |
| **P3-Minor** | Cosmetic, low-impact, or easily worked around | Address before phase is marked COMPLETE |

### RCA requirements

Every issue entry must include a Root Cause Analysis with these fields:

- **Symptom** — what was observed
- **Root Cause** — the actual underlying reason (not just the symptom)
- **Contributing Factors** — anything that made the issue more likely or harder to detect
- **Resolution** — what was changed to fix it
- **Prevention** — what process or test would catch this earlier in future

An RCA is **not complete** if it only describes the symptom. Push to the actual root cause.

### Issue lifecycle

```
OPEN → IN PROGRESS → RESOLVED → CLOSED
                  ↘ WONT FIX (with justification)
```

An issue is `CLOSED` only when:
1. The resolution has been implemented and committed
2. The test that would have caught the issue now exists and passes
3. The issue entry in `issues-log.md` has been updated with the final resolution

---

## Phase Transition Protocol

When you believe a phase is ready for its gate check:

1. Run the full test suite: `npx vitest run --coverage`
2. Run E2E if applicable: `npx playwright test`
3. Run linting: `npm run lint && npm run check`
4. Record all scores in `Status.md` under the phase row
5. If **all thresholds are met:**
   - Update phase status to `COMPLETE` in `Status.md`
   - Proceed to the next phase
6. If **any threshold is not met:**
   - Update phase status to `BLOCKED` in `Status.md`
   - Create an issue in `issues-log.md` with full RCA
   - If it is a **hard gate**: stop all forward progress until resolved
   - If it is a **soft gate**: document the exception in `Status.md`, get PO acknowledgement,
     then proceed with the exception noted

---

## Session End Checklist

Before ending a session:

1. Update `Status.md` — record what was completed, what was not, and what the next task is
2. Ensure all open issues have at least an RCA started in `issues-log.md`
3. Commit all work-in-progress with a clear commit message referencing the phase
4. If mid-phase, leave a `# TODO` comment in the relevant file indicating the next step

---

## Notes for Claude Code

- Always read `Status.md` and `issues-log.md` before proposing or writing code
- Never advance a phase that has an unresolved P1-Critical issue
- When implementing, refer to `application-plan.md` for full code examples — do not
  invent architecture not documented there without flagging it first
- When a CRC card's collaborators list does not match what the code needs, flag it before
  implementing — it likely means a design gap that should be resolved in `build-process.md`
- Update `Status.md` proactively; do not wait to be asked
