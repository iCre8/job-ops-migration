# Job Ops

Nx/pnpm monorepo. The SvelteKit app at `apps/web` is the current production target — it has full feature parity with the legacy React/Express orchestrator and replaces it. The orchestrator is retained for reference only.

## Workspace Layout

- **apps/web** — SvelteKit 2 + Svelte 5 + tRPC v11 + MongoDB (Prisma v6) — **primary app**
- orchestrator — legacy React/Express app (reference only; not the active target)
- shared — shared TypeScript types and utilities
- career-boards/*, extractors/* — job board integrations
- docs-site — Docusaurus documentation
- apps/hermes-agent — background worker daemon for job authenticity verification

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

`apps/web` uses MongoDB with Prisma 6. MongoDB schema changes are applied with `db push`; Prisma migrate is not supported for MongoDB.

```bash
cd apps/web
cp .env.example .env
pnpm db:push
pnpm db:generate
```

Set `DATABASE_URL` in `apps/web/.env` or the shell before running Prisma commands. In this Nx monorepo, app-specific env belongs beside the project that consumes it:

```env
DATABASE_URL=mongodb://jobops:password@localhost:27017/jobops?authSource=admin&directConnection=true
```

### First-Run Authentication

The SvelteKit app uses JWT cookie auth. If no users exist, the onboarding UI can create the first system admin. For repeatable local setup or CI smoke data, seed the admin user explicitly:

```bash
cd apps/web
SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD=change-this-password pnpm db:seed
```

`pnpm db:seed` is idempotent: it creates the admin user when absent and updates/promotes the same username when present. `SEED_ADMIN_PASSWORD` is required so the seed never creates an unknown credential.

### Prisma Studio

Run Studio from the app package so it uses the app-local schema path:

```bash
cd apps/web
pnpm db:studio
```

Studio runs at `http://localhost:5555` and reads `DATABASE_URL` from `apps/web/.env` because the Nx/package target runs with `cwd=apps/web`. If the port is occupied, stop the existing Studio process or run Prisma manually with another port.

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

