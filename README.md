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

## Running Your First Job Search Pipeline (Matched Against Resume)

To run a job search pipeline and match discovered roles against your resume, follow this sequence:

### 1. Ensure Backend Services & Sidecars Are Running
Ensure that the SvelteKit application and the required MongoDB backend database services are up:
```bash
# Start MongoDB (local replica set for SvelteKit / Prisma)
cd apps/web
docker compose up -d

# Start SvelteKit app in dev mode
pnpm dev
```

By default, SvelteKit communicates with the Python JobSpy sidecar. Make sure the sidecar FastAPI server is running on port `8000`. You can launch it using:
```bash
cd services/extractor
pip install -r requirements.txt
uvicorn http_server:app --host 0.0.0.0 --port 8000
```
*(Ensure `EXTRACTOR_URL=http://localhost:8000` is defined in your environment or `apps/web/.env` file).*

### 2. Configure Your AI Model & Resume Context
1. Log in to the application and navigate to the **Settings** page (`/settings`).
2. **AI Model**: Select the **AI Model** tab. Choose your provider (e.g. OpenRouter or OpenAI), input your API key, choose a model, and click **Test Connection**.
3. **Resume Details**: Select the **Prompt Templates** tab. In the **Scorer prompt additions** text box, paste the text of your resume or list your specific skills and experience details. This context is appended to the AI suitability scorer prompt to match jobs against your profile.
4. Click **Save Settings** in the settings panel.

### 3. Trigger Your First Pipeline Run
1. Navigate to the **Jobs** tab (`/jobs`).
2. Click the gear/configuration icon at the top right (next to the "+ Import" button) to toggle the **Pipeline Configuration** panel.
3. Select your target **Job Boards** (e.g. LinkedIn, Indeed, Glassdoor).
4. Enter target job keywords/titles in the **Search terms** input.
5. Enter a location (e.g. `New York, NY`) or set the **Remote only** checkbox.
6. Click **Run Pipeline**. The logs will stream raw scraping outputs and scoring phases in real time, importing matching jobs to your dashboard.

### 4. Troubleshooting Common Obstacles
- **Issue: `EXTRACTOR_URL environment variable is not set`**
  - **Fix**: Open the `apps/web/.env` file and append `EXTRACTOR_URL=http://localhost:8000` (or the URL where your Python sidecar FastAPI server is running).
- **Issue: Scrape fails with `ConnectionRefusedError` or `Extractor returned 500`**
  - **Fix**: Verify that the Python FastAPI server is active by visiting `http://localhost:8000/health` in your browser or executing `curl http://localhost:8000/health`. If it's down, check the console output of the `http_server.py` command for missing python packages or blocked ports.
- **Issue: "LLM not configured — default score applied" or scores are all 50**
  - **Fix**: Make sure you have entered a valid API Key and clicked **Save Settings** in `/settings` -> **AI Model**. Check that your model name matches your provider's supported models (e.g., `openai/gpt-4o-mini` on OpenRouter, or `gpt-4o-mini` on OpenAI).
- **Issue: `JobSpy` scraping block or empty results**
  - **Fix**: JobSpy requests directly query external job boards. If you get 0 jobs discovered:
    - Try running the pipeline again in a few minutes.
    - Reduce the number of search terms or expand the search location.
    - Confirm you can reach Indeed/LinkedIn from your network without captcha flags.

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

