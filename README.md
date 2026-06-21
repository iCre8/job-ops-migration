# Job Ops

Nx/pnpm monorepo for the original JobOps application. The primary app remains the upstream React/Vite orchestrator UI under orchestrator; apps/web is transitional and is no longer the default app target.

## Workspace Layout

- orchestrator - original JobOps React UI and Express/API server.
- shared - shared TypeScript types and utilities.
- career-boards/* and extractors/* - job board integrations.
- docs-site - Docusaurus documentation.
- apps/hermes-agent - background worker daemon verifying job authenticity.
- apps/web - transitional SvelteKit/Prisma MongoDB prototype, retained but not the default UI.

## Package Manager

Use pnpm only. The root preinstall script rejects npm/yarn installs.

```bash
pnpm install
```

## Common Commands

```bash
pnpm dev             # nx dev orchestrator; runs original server and Vite UI
pnpm dev:server      # original orchestrator API/server only
pnpm dev:client      # original orchestrator Vite UI only
pnpm build           # nx build orchestrator
pnpm check           # nx typecheck orchestrator
pnpm test            # nx test orchestrator
pnpm affected:test   # run tests only for affected Nx projects
pnpm dep-graph       # Nx project graph
```

## Database Setup & Migration

The orchestrator now uses **PostgreSQL** as its primary datastore (via Drizzle ORM) in development and production, replacing the previous SQLite implementation.

### Local Development
To run the orchestrator locally, you must provide a PostgreSQL instance and configure it in your `.env` file:
```bash
cp .env.example .env
```
Ensure your `.env` specifies the `DATABASE_URL`:
```env
DATABASE_URL=postgres://username:password@localhost:5432/jobops
```

Once the database is running, execute Drizzle migrations:
```bash
pnpm --filter job-ops-orchestrator db:migrate
```

### First-Run Authentication

The app uses **JWT authentication** — there is no HTTP Basic Auth. On first run, if no users exist, the sign-in page redirects to an onboarding wizard where you create the initial admin account.

Alternatively, set `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` in `.env` before running `db:migrate` to have the migration automatically seed the first admin user. After the first user exists, these variables are ignored entirely.

```env
BASIC_AUTH_USER=admin
BASIC_AUTH_PASSWORD=your-secure-password
```

### Automated Tests
For integration testing, the application utilizes `@electric-sql/pglite` (an in-memory WASM PostgreSQL database engine). This provides complete dialect consistency with production PostgreSQL, allowing tests to run instantly without requiring a live PostgreSQL instance.

---

## File Watcher Limit (ENOSPC) Troubleshooting

In resource-constrained environments (such as Docker containers or certain Linux installations), running `pnpm dev` may fail with `ENOSPC: System limit for number of file watchers reached`.

We have resolved this with two fallback configurations:
1. **Vite Polling**: Vite is configured in `vite.config.ts` to use polling instead of the standard system file watchers.
2. **Backend Execution**: The backend server command (`dev:server` in `package.json`) executes the Node server directly via `tsx` without the watch flag.

---

## Change Tracking Logs

We maintain three dedicated changelogs in the repository root to log updates systematically:
- [app-change.log](file:///home/s4developer/engineering-projects/job-ops-migration/app-change.log): Tracks application, service, repository, and component logic changes.
- [infrastructure-change.log](file:///home/s4developer/engineering-projects/job-ops-migration/infrastructure-change.log): Tracks database engines, test environments, and hosting changes.
- [configuration-change.log](file:///home/s4developer/engineering-projects/job-ops-migration/configuration-change.log): Tracks packages, tooling, scripts, and environment variable configuration changes.

