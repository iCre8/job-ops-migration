# Repository Guidelines

## Project Structure & Module Organization

This is an Nx/pnpm monorepo. The primary application is orchestrator, which contains the original JobOps React/Vite UI in orchestrator/src/client and the Express/API server in orchestrator/src/server. Shared types and utilities live in shared/src. Job-board integrations live in career-boards/* and extractors/*. Documentation lives in docs-site. apps/web is a transitional SvelteKit/Prisma MongoDB prototype and is not the default UI.

## Build, Test, and Development Commands

Use pnpm from the repository root. pnpm dev runs nx dev orchestrator; use pnpm dev:server or pnpm dev:client for one side only. pnpm build, pnpm check, and pnpm test run the orchestrator Nx targets. Use pnpm affected:check, pnpm affected:test, and pnpm affected:build to limit validation to changed projects.

## Coding Style & Naming Conventions

Use TypeScript and ES modules. The original app uses React, Vite, Tailwind, Biome, and path aliases such as @client, @server, and job-ops-shared. Keep package-local code inside its workspace and add Nx project.json targets when a package needs explicit build, test, lint, or typecheck behavior.

## Testing Guidelines

Orchestrator tests use Vitest and live beside source as .test.ts or .test.tsx. Shared and extractor packages expose check:types; some extractors also expose test:run. Run pnpm nx show projects to confirm Nx sees a new workspace package.

## Commit & Pull Request Guidelines

Use concise, imperative commit messages. PRs should identify affected projects, list verification commands, and include screenshots for UI changes. Preserve the upstream orchestrator UI unless a UI change is intentional.

## Security & Configuration Tips

Copy .env.example to .env; never commit secrets. Docker Compose is still the self-hosted quick start and serves job-ops on port 3005. App data persists in ./data; Codex auth persists in the codex-home Docker volume.
