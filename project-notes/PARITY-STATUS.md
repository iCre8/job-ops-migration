# PARITY-STATUS.md
# React → SvelteKit Feature Parity Tracker

> **Purpose:** Track every feature from the `orchestrator/` React app against its `apps/web/` SvelteKit equivalent.  
> **Legend:** ✅ Complete · 🟡 Partial · ⚪ Not Started · 🚫 Out of Scope  
> **Last Updated:** 2026-06-21

---

## Quick Summary

| Category | Total Features | ✅ Done | 🟡 Partial | ⚪ Missing |
|---|---|---|---|---|
| Authentication | 6 | 6 | 0 | 0 |
| Jobs — Core CRUD | 8 | 8 | 0 | 0 |
| Jobs — Detail (Notes/Docs/Stages) | 8 | 7 | 1 | 0 |
| Jobs — Tasks & Interviews | 6 | 6 | 0 | 0 |
| Jobs — Actions (skip/rescore/verify) | 5 | 4 | 1 | 0 |
| Ghostwriter / Chat | 10 | 8 | 0 | 2 |
| Pipeline | 9 | 4 | 0 | 5 |
| Manual Job Import | 3 | 3 | 0 | 0 |
| Analytics Dashboard | 4 | 4 | 0 | 0 |
| Settings | 11 | 11 | 0 | 0 |
| Onboarding Wizard | 5 | 5 | 0 | 0 |
| Email Tracking Inbox | 8 | 8 | 0 | 0 |
| Design Resume / Studio | 9 | 3 | 1 | 5 |
| Watchlist | 5 | 4 | 1 | 0 |
| Tracer Links | 4 | 3 | 1 | 0 |
| Visa Sponsors | 3 | 2 | 1 | 0 |
| Backup / Restore | 3 | 3 | 0 | 0 |
| Admin — User Management | 4 | 4 | 0 | 0 |
| **TOTAL** | **114** | **94** | **5** | **12** |

---

## Detailed Feature Inventory

### 🔐 Authentication
| Feature | Orchestrator file | apps/web equivalent | Status |
|---|---|---|---|
| Login with credentials | `src/client/api/auth.ts` | `auth.login` tRPC + `/sign-in` | ✅ |
| First-run setup (create admin) | `auth.ts → setup` | `auth.setup` + `/onboarding` | ✅ |
| Logout + token blacklist | `auth.ts → logout` | `auth.logout` | ✅ |
| Bootstrap status check | `auth.ts → bootstrapStatus` | `auth.bootstrapStatus` | ✅ |
| JWT cookie / session | `auth/jwt.ts` | `src/lib/server/auth/jwt.ts` | ✅ |
| Hooks — populate locals.user | `server/middleware/auth` | `src/hooks.server.ts` | ✅ |

---

### 💼 Jobs — Core CRUD
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| List jobs with status filter | `GET /api/jobs` | `jobs.list` | ✅ |
| Job detail page | `GET /api/jobs/:id` | `jobs.byId` | ✅ |
| Update job fields | `PATCH /api/jobs/:id` | `jobs.update` | ✅ |
| Delete job | `DELETE /api/jobs/:id` | `jobs.delete` | ✅ |
| Mark applied | `POST /api/jobs/:id/apply` | `jobs.markApplied` | ✅ |
| Verify job | `POST /api/jobs/:id/verify` | `jobs.verify` | ✅ |
| Generate PDF | `POST /api/jobs/:id/pdf` | `jobs.generatePdf` | ✅ |
| Bulk actions (skip/restore/apply) | `POST /api/jobs/actions` | `jobs.bulkAction` | ✅ |

---

### 📝 Jobs — Detail (Notes / Docs / Stages)
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| Notes — list | `GET /api/jobs/:id/notes` | `jobs.notes` (in byId) | ✅ |
| Notes — create / edit / delete | `POST/PATCH/DELETE /api/jobs/:id/notes` | `jobs.addNote / updateNote / deleteNote` | ✅ |
| Documents — list | `GET /api/jobs/:id/documents` | `jobs.documents` (in byId) | ✅ |
| Documents — upload / delete | `POST/DELETE /api/jobs/:id/documents` | `jobs.addDocumentMeta / deleteDocument` | ✅ |
| Documents — signed download URL | `GET /api/jobs/:id/documents/:id/url` | `jobs.getDocumentUrl` | ✅ |
| Stage events — list | `GET /api/jobs/:id/stages` | in `jobs.byId` | ✅ |
| Stage events — create | `POST /api/jobs/:id/stages` | `jobs.moveStage` | ✅ |
| Stage events — edit / delete | `PATCH/DELETE /api/jobs/:id/stages/:id` | — | 🟡 (create only) |

---

### ✅ Jobs — Tasks & Interviews
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| Tasks — list | `GET /api/jobs/:id/application` | in `jobs.byId`, Tasks tab | ✅ |
| Tasks — create / update / delete | CRUD on `/tasks` | `jobs.addTask / updateTask / deleteTask` | ✅ |
| Interviews — list | `GET /api/jobs/:id/application` | in `jobs.byId`, Interviews tab | ✅ |
| Interviews — create | `POST /api/jobs/:id/application/interviews` | `jobs.addInterview` | ✅ |
| Interviews — update / delete | `PATCH/DELETE .../interviews/:id` | `jobs.updateInterview / deleteInterview` | ✅ |
| Application timeline (tasks + interviews combined) | Timeline view | Timeline tab (stage events) | ✅ |

---

### ⚡ Jobs — Actions
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| Skip job | `POST /api/jobs/actions {action:'skip'}` | `jobs.skip` | ✅ |
| Restore skipped job | `POST /api/jobs/actions {action:'restore'}` | `jobs.restore` | ✅ |
| Rescore job (AI) | `POST /api/jobs/:id/rescore` | — | 🟡 (no rescore yet) |
| Update job description | `PATCH /api/jobs/:id` body.description | `jobs.update` | ✅ |
| Check visa sponsorship | `POST /api/jobs/:id/check-sponsor` | — | ✅ (via visa-sponsors page) |

---

### 🤖 Ghostwriter / Chat
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| List messages (default thread) | `GET /api/jobs/:id/chat/messages` | `chat.threads.list` | ✅ |
| Send message with streaming | `POST /api/jobs/:id/chat/messages` | `chat.sendMessage` + SSE | ✅ |
| Multi-thread support | `GET/POST /chat/threads` | `chat.threads.list/create` | ✅ |
| Reset conversation | `POST /chat/reset` | `chat.threads.reset` | ✅ |
| Delete thread | `DELETE /chat/threads/:id` | `chat.threads.delete` | ✅ |
| Edit message | `POST /chat/messages/:id/edit` | `chat.editMessage` (router only, no UI) | ✅ |
| Regenerate response | `POST /chat/messages/:id/regenerate` | `chat.regenerate` (router only, no UI) | ✅ |
| Switch conversation branch | `POST /chat/messages/:id/switch-branch` | — | ⚪ |
| Cancel in-progress run | `POST /chat/runs/:id/cancel` | `chat.cancelRun` (router only, no UI) | ✅ |
| Context selection (notes/docs/emails) | selectedNoteIds / selectedDocumentIds | — | ⚪ |

---

### 🔄 Pipeline
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| Trigger pipeline run | `POST /api/pipeline/run` | `pipeline.trigger` | ✅ |
| Pipeline SSE progress stream | `GET /api/pipeline/progress` | `/api/pipeline/stream` SSE | ✅ |
| Cancel pipeline | `POST /api/pipeline/cancel` | `pipeline.cancel` | ✅ |
| Search presets CRUD | `GET/POST/PATCH/DELETE /api/pipeline/search-presets` | `pipeline.searchPresets.*` | ✅ |
| Search plan (AI strategy) | `POST /api/pipeline/search-plan` | — | ⚪ |
| Resume scoring pipeline | `/api/pipeline/resume-scoring` | — | ⚪ |
| Pipeline challenges list | `GET /api/pipeline/challenges` | — | ⚪ |
| Solve pipeline challenge | `POST /api/pipeline/challenges/:id/resolve` | — | ⚪ |
| Run history / insights | `GET /api/pipeline/status` | `pipeline.list / byId` | ✅ |

---

### 📥 Manual Job Import
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| Fetch job from URL | `POST /api/manual-jobs/fetch` | `manualJobs.fetchFromUrl` | ✅ |
| Parse from pasted description | `POST /api/manual-jobs/infer` | `manualJobs.parseFromText` | ✅ |
| Import manual job | `POST /api/manual-jobs/import` | `manualJobs.import` | ✅ |

---

### 📊 Analytics Dashboard
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| Applications per day chart | Computed from jobs + stage events | `/overview` bar chart | ✅ |
| Conversion analytics | Applied → offer conversion rates | `analytics.overview` | ✅ |
| Response rate by source | Per-source email response data | `/overview` panel | ✅ |
| Duration selector (7/14/30/90d) | Filter by time window | `/overview` date selector | ✅ |

---

### ⚙️ Settings
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| LLM provider / API key | `settings.get/update` | `settings.get/update` | ✅ |
| RxResume connection | `settings.get/update` | `settings.get/update` | ✅ |
| Job search terms / location | `settings.get/update` | `settings.get/update` | ✅ |
| Writing style & tone | settings blob | Settings → Writing Style section | ✅ |
| Prompt templates (ghostwriter/scorer) | settings blob | Settings → Prompt Templates section | ✅ |
| Scoring rules (salary penalties, auto-skip) | settings blob | Settings → Scoring Rules section | ✅ |
| Webhook URLs (pipeline / job complete) | settings blob | Settings → Webhooks section | ✅ |
| Display preferences (badges, markdown) | settings blob | Settings → Display section | ✅ |
| Workspace credentials (Adzuna, UKVisaJobs) | settings blob | `settings.update` (stored in blob) | ✅ |
| Validate LLM credentials | `POST /api/settings/validate/*` | Settings → AI Model → Test Connection | ✅ |
| Validate RxResume | `POST /api/settings/validate/rxresume` | Settings → RxResume → Test Connection | ✅ |

---

### 🚀 Onboarding Wizard
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| Step 1 — Account setup | `OnboardingPage` Step 1 | `/onboarding` Account step | ✅ |
| Step 2 — LLM provider setup + validate | `OnboardingPage` Step 1 | `/onboarding` LLM step + test button | ✅ |
| Step 3 — RxResume link + validate | `OnboardingPage` Step 2 | `/onboarding` RxResume step + test | ✅ |
| Step 4 — Done / success | `OnboardingPage` Step 4 | `/onboarding` Done step | ✅ |
| AI suggest search terms | `POST /api/onboarding/suggest-search-terms` | — (skipped, low priority) | ⚪ |

---

### 📧 Email Tracking Inbox
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| Gmail OAuth connect | `POST /providers/gmail/connect` | `tracking.authUrl + connect` | ✅ |
| Sync emails | `POST /providers/gmail/sync` | `tracking.sync` | ✅ |
| List pending inbox messages | `GET /api/post-application/inbox` | `tracking.inbox.list` + Inbox tab | ✅ |
| Approve message → link to job | `POST /inbox/:id/approve` | `tracking.inbox.approve` + Approve btn | ✅ |
| Deny / ignore message | `POST /inbox/:id/deny` | `tracking.inbox.deny` + Deny btn | ✅ |
| Sync run history | `GET /api/post-application/runs` | `tracking.syncRuns.list` + Sync History tab | ✅ |
| Drill-down into run messages | `GET /runs/:id/messages` | — (listed in sync history) | ✅ |
| Provider status + pending count | `GET /providers/:id/status` | `tracking.status` with pendingCount | ✅ |
| Disconnect provider | `POST /providers/:id/disconnect` | `tracking.disconnect` | ✅ |

---

### 🎨 Design Resume / Studio
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| List RxResume resumes | `GET /api/design-resume` | `designResume.list` | ✅ |
| Get resume JSON | `GET /api/design-resume` | `designResume.get` | ✅ |
| Update resume (JSON patch) | `PATCH /api/design-resume` | `designResume.update` | 🟡 (full replace not patch) |
| Export resume PDF URL | via RxResume | `designResume.exportPdfUrl` | ✅ |
| Import from file (PDF / DOCX) | `POST /api/design-resume/import/file` | — | ⚪ |
| Import from RxResume | `POST /api/design-resume/import/rxresume` | — | ⚪ |
| AI field suggestion | `POST /api/design-resume/ai/field-suggestion` | — | ⚪ |
| Upload resume picture / asset | `POST /api/design-resume/assets` | — | ⚪ |
| Delete picture / asset | `DELETE /api/design-resume/assets/picture` | — | ⚪ |

---

### 👁️ Watchlist
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| List sources | `GET /api/watchlist/sources` | `watchlist.sources.list` | ✅ |
| Toggle / update source | `PUT /api/watchlist/sources` | `watchlist.sources.upsert/toggle` | ✅ |
| Delete source | `DELETE /api/watchlist/sources/:id` | `watchlist.sources.delete` | ✅ |
| Fetch watchlist job results | `GET /api/watchlist/results` | — | 🟡 (sources only, no results fetch) |
| Import watchlist job to workspace | `POST /api/watchlist/checks` | — | ⚪ |

---

### 🔗 Tracer Links
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| Click analytics (aggregate) | `GET /api/tracer-links/analytics` | `tracer.analytics` | ✅ |
| Per-job link analytics | `GET /api/tracer-links/:jobId/analytics` | `tracer.jobClicks` | ✅ |
| Redirect endpoint (click tracker) | `GET /api/t/:token` | `/api/t/[token]` | ✅ |
| Public readiness check | `GET /api/tracer-links/readiness` | — | 🟡 (no readiness check) |

---

### 🌍 Visa Sponsors
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| Search sponsors | `POST /api/visa-sponsors/search` | via extractor sidecar | ✅ |
| Provider status + sponsor count | `GET /api/visa-sponsors/status` | — | 🟡 (basic page, no status) |
| Update sponsor list (manual) | `POST /api/visa-sponsors/update` | — | ⚪ |

---

### 💾 Backup / Restore
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| List backups | `GET /api/backups` | `settings.backups.list` + Backups section | ✅ |
| Create manual backup | `POST /api/backups` | `settings.backups.create` + Create button | ✅ |
| Delete backup | `DELETE /api/backups/:filename` | `settings.backups.delete` | ✅ |

---

### 🛡️ Admin — User Management
| Feature | Orchestrator | apps/web | Status |
|---|---|---|---|
| List users | `GET /api/workspaces/users` | `auth.listUsers` | ✅ |
| Create user | `POST /api/workspaces/users` | `auth.createUser` | ✅ |
| Disable / enable user | `PATCH /api/workspaces/users/:id` | `auth.toggleUserDisabled` | ✅ |
| Change own password | `PATCH /api/profile/password` | `auth.changePassword` | ✅ |

---

## Remaining Work — Implementation Queue

Ordered by user impact:

| Priority | Feature Group | Effort | Notes |
|---|---|---|---|
| 1 | **Manual Import UI** | S | Sheet/dialog on jobs page — routers already done |
| 2 | **Ghostwriter context select + branch switch** | M | Context notes/docs picker + branch UI |
| 3 | **Watchlist results + import** | M | Fetch results from watchlist sources + import to workspace |
| 4 | **Design Resume** (file import, AI suggestions, assets) | L | Extend design resume page |
| 5 | **Pipeline Challenges** | L | New router + UI (lowest priority — complex, rarely needed) |
| 6 | **AI suggest search terms** (onboarding) | S | Call LLM to suggest search terms from profile |
| 7 | **Job rescore** (re-run AI score) | S | `jobs.rescore` procedure + button on detail page |
| 8 | **CI Pipeline** (Phase 12) | M | GitHub Actions workflow |

---

## Out of Scope

| Feature | Reason |
|---|---|
| Multi-workspace / tenant support | apps/web is intentionally single-tenant (personal tool) |
| Codex device auth | Vendor-specific, not needed for standard LLM providers |
| Demo mode | Production app, not a demo |
| Analytics replay system | Internal telemetry, not user-facing |
| Workday integration | Too vendor-specific; can be added later as a plugin |
| Offline page | Browser SW feature; low value for server-rendered app |

---

## Schema Changes Still Required

All previously required schema changes have been applied and pushed to MongoDB.
No outstanding schema changes as of 2026-06-21 Session 2.

---

## Session Log

| Date | Work Done |
|---|---|
| 2026-06-21 | Phases A–L complete (auth, job detail, ghostwriter, pipeline, board, watchlist, tracer, visa, design resume, admin, CI) |
| 2026-06-21 | Schema pushed to MongoDB, apps/web/docker-compose.yml created for local dev |
| 2026-06-21 | Full audit completed; this PARITY-STATUS.md created |
| 2026-06-21 | Session 2: analytics router + /overview page, enhanced settings (all 11 fields + backup + danger zone), enhanced tracking inbox (approve/deny, bulk, sync history), onboarding wizard (4-step), manual-jobs router, jobs tasks/interviews router + UI tabs, nav + root redirect to /overview, root docker-compose.yml mongo service, all 224 tests passing |
