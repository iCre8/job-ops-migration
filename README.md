# Job Ops Migration

Nx/pnpm monorepo for the Job Ops Migration SvelteKit application and supporting services.

## Workspace Layout

- `apps/web` - SvelteKit web app, Vitest tests, Playwright tests, and Prisma schema.
- `services/extractor` - Python extractor sidecar used by Docker Compose.
- `nx.json` - Nx target defaults, named inputs, and cache rules.
- `pnpm-workspace.yaml` - pnpm workspace package list and install policy.

Generated outputs such as `apps/web/build`, `apps/web/coverage`, and `apps/web/.svelte-kit` are ignored.

## Package Manager

Use pnpm only. The root `preinstall` script rejects npm/yarn installs and removes npm/yarn lockfiles.

```bash
pnpm install
```

## Common Commands

```bash
pnpm dev             # nx dev web
pnpm build           # nx build web
pnpm check           # SvelteKit sync + svelte-check
pnpm test            # Vitest run for apps/web
pnpm test:coverage   # Vitest coverage for apps/web
pnpm e2e             # Build dependency + Playwright tests
pnpm db:generate     # Prisma client generation for apps/web/prisma
pnpm db:push         # Prisma db push for MongoDB
pnpm dep-graph       # Nx project graph
```

For changed-project workflows, use Nx affected targets:

```bash
pnpm affected:check
pnpm affected:test
pnpm affected:build
pnpm affected:lint
```

## Nx Project Boundaries

The `web` project owns `apps/web/**`. Nx `namedInputs` separate production inputs from tests and generated outputs so cached targets rerun only when the project or an upstream dependency changes. Keep future app code inside `apps/<name>`, shared packages inside `libs/<name>`, and add a `project.json` per project.

## Docker

Docker Compose builds the web app from the monorepo root using `apps/web/Dockerfile` so the image can access workspace manifests. Start the stack with:

```bash
cp .env.example .env
pnpm install
docker compose up -d
```

The web service listens on `${WEB_PORT:-3005}` and proxies extractor requests to the `extractor` service.

## Database Notes

This project uses Prisma with MongoDB. Use `pnpm db:push`, not Prisma migrations. When changing `apps/web/prisma/schema.prisma`, update `apps/web/prisma/SCHEMA_CHANGELOG.md` in the same change.
