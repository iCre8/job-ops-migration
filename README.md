# Job Ops

Nx/pnpm monorepo for the original JobOps application. The primary app remains the upstream React/Vite orchestrator UI under orchestrator; apps/web is transitional and is no longer the default app target.

## Workspace Layout

- orchestrator - original JobOps React UI and Express/API server.
- shared - shared TypeScript types and utilities.
- career-boards/* and extractors/* - job board integrations.
- docs-site - Docusaurus documentation.
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

## Docker

Docker is still the upstream self-hosted quick-start path. It builds the original single-container JobOps app from Dockerfile, serves the app on http://localhost:3005, and persists app data in ./data plus the codex-home volume.

```bash
cp .env.example .env
pnpm install
docker compose up -d
```

The original app uses local SQLite/Drizzle data under DATA_DIR; MongoDB is only used by the transitional apps/web prototype.
