# Repository Guidelines

## Project Structure & Module Organization

This is an Nx/pnpm monorepo. The SvelteKit app is `apps/web`; its routes live in `apps/web/src/routes`, shared client modules in `apps/web/src/lib`, and server-only code in `apps/web/src/lib/server`. Prisma schema and database notes are in `apps/web/prisma`. Unit, integration, and E2E tests are under `apps/web/tests`. The Python extractor sidecar remains in `services/extractor` and is wired through Docker Compose.

## Build, Test, and Development Commands

Use pnpm from the repository root. `pnpm dev` runs `nx dev web`. `pnpm build`, `pnpm check`, `pnpm test`, `pnpm test:coverage`, and `pnpm e2e` run the corresponding Nx targets for `web`. Use `pnpm affected:check`, `pnpm affected:test`, `pnpm affected:build`, and `pnpm affected:lint` before broad changes so Nx only executes projects affected by the diff. Database commands are `pnpm db:generate`, `pnpm db:push`, and `pnpm db:studio`.

## Coding Style & Naming Conventions

Use TypeScript with strict settings and ES modules. Prefer `$lib` imports inside the SvelteKit app. Keep route files in SvelteKit form: `+page.svelte`, `+page.server.ts`, and `+server.ts`. Name Vitest files `.test.ts` and Playwright files `.spec.ts`. New apps belong in `apps/<name>`; shared packages belong in `libs/<name>` with their own `project.json`.

## Testing Guidelines

Vitest covers unit and integration tests in `apps/web/tests` and excludes `tests/e2e`. Coverage applies to `apps/web/src/lib/**` with thresholds of 80% lines/functions/statements and 75% branches. Playwright tests live in `apps/web/tests/e2e` and run through `pnpm e2e` after the build target.

## Commit & Pull Request Guidelines

Use concise, imperative commit messages such as `Add web Nx targets`. Pull requests should describe the changed project, list verification commands, call out Prisma schema changes, and include screenshots for UI changes. Prefer Nx affected commands in PR validation notes.

## Security & Configuration Tips

Copy `.env.example` to `.env` for local setup and never commit secrets. This project uses Prisma with MongoDB, so use `pnpm db:push`, not migrations. When changing `apps/web/prisma/schema.prisma`, update `apps/web/prisma/SCHEMA_CHANGELOG.md` in the same change.
