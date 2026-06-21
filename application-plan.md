# application-plan.md
# Job-Ops Migration Plan: SvelteKit + MongoDB + tRPC + DigitalOcean Spaces

## Architectural Decisions (Confirmed)

| Concern | Decision |
|---|---|
| MongoDB hosting | Self-hosted in Docker Compose |
| Object storage | DigitalOcean Spaces (S3-compatible) |
| Rendering | SvelteKit SSR + `adapter-node` |
| API layer | tRPC (end-to-end type safety) |
| ORM | Prisma v7 (`db push`, no migration history) |
| Python extractors | Keep as HTTP sidecar (jobspy unchanged) |
| UI components | shadcn-svelte + Tailwind CSS v4 |
| Migration strategy | Full rewrite in `job-ops-migration/` — legacy stays for reference |

> **Prisma v7 + MongoDB note:** `prisma migrate` is not supported for MongoDB. All schema
> changes are applied with `prisma db push`. There are no migration files. Schema history is
> tracked in git via `schema.prisma` changes. Document every schema change in a
> `SCHEMA_CHANGELOG.md` inside `job-ops-migration/prisma/`.

---

## Migration Root Directory Structure

```
job-ops-migration/
├── apps/
│   └── web/                          # SvelteKit application
│       ├── src/
│       │   ├── lib/
│       │   │   ├── server/
│       │   │   │   ├── db/           # Prisma client singleton
│       │   │   │   ├── trpc/         # tRPC routers (one file per domain)
│       │   │   │   ├── services/     # Business logic (storage, PDF, LLM, pipeline)
│       │   │   │   │   ├── storage/  # StorageProvider + DO Spaces impl
│       │   │   │   │   ├── llm/      # LLM provider factory
│       │   │   │   │   ├── pdf/      # RxResume + DO Spaces write
│       │   │   │   │   ├── pipeline/ # Job orchestration
│       │   │   │   │   └── post-application/ # Gmail + email classification
│       │   │   │   ├── extractors/   # HTTP client to Python sidecar
│       │   │   │   └── infra/        # Logger, SSE helpers, request ID
│       │   │   ├── trpc/             # Client-side tRPC + SvelteKit hooks
│       │   │   ├── components/       # shadcn-svelte + custom components
│       │   │   └── utils/            # Shared helpers (date, filename, etc.)
│       │   ├── routes/
│       │   │   ├── (app)/            # Authenticated app shell
│       │   │   │   ├── +layout.svelte
│       │   │   │   ├── +layout.server.ts
│       │   │   │   ├── jobs/
│       │   │   │   │   ├── +page.svelte         # Job list / orchestrator
│       │   │   │   │   └── [id]/
│       │   │   │   │       └── +page.svelte     # Job detail
│       │   │   │   ├── settings/
│       │   │   │   │   └── +page.svelte
│       │   │   │   └── tracking/
│       │   │   │       └── +page.svelte
│       │   │   ├── api/
│       │   │   │   └── trpc/
│       │   │   │       └── [trpc]/
│       │   │   │           └── +server.ts       # tRPC HTTP handler
│       │   │   ├── oauth/
│       │   │   │   └── gmail/
│       │   │   │       └── callback/
│       │   │   │           └── +server.ts
│       │   │   ├── pdfs/
│       │   │   │   └── [jobId]/
│       │   │   │       └── +server.ts           # Signed URL redirect / stream
│       │   │   ├── health/
│       │   │   │   └── +server.ts
│       │   │   └── +layout.svelte               # Root layout
│       │   ├── app.d.ts
│       │   ├── app.html
│       │   └── hooks.server.ts                  # Request ID injection, auth
│       ├── tests/
│       │   ├── unit/                            # Vitest unit tests
│       │   │   ├── services/
│       │   │   ├── trpc/
│       │   │   └── utils/
│       │   ├── integration/                     # Vitest + real MongoDB (in-memory)
│       │   │   ├── trpc/
│       │   │   └── services/
│       │   └── e2e/                             # Playwright
│       │       ├── jobs.spec.ts
│       │       ├── settings.spec.ts
│       │       └── tracking.spec.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── SCHEMA_CHANGELOG.md
│       ├── static/
│       ├── svelte.config.js
│       ├── vite.config.ts
│       ├── playwright.config.ts
│       ├── eslint.config.js
│       ├── tsconfig.json
│       └── package.json
├── services/
│   └── extractor/                    # Python jobspy sidecar
│       ├── scrape_jobs.py            # Adapted from legacy extractors/jobspy/
│       ├── http_server.py            # FastAPI wrapper (new)
│       ├── requirements.txt
│       └── Dockerfile
├── shared/
│   └── src/
│       └── types/                    # Migrated from legacy shared/src/types/
│           ├── jobs.ts
│           ├── settings.ts
│           ├── api.ts
│           └── trpc.ts               # tRPC router type exports
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Phase 1 — Data Model

### 1.1 MongoDB Schema Design Decisions

The current SQLite schema has 13 tables. In MongoDB, tightly coupled child rows are
embedded; loosely coupled or high-volume records stay as separate collections.

| SQLite Table | MongoDB Strategy | Reason |
|---|---|---|
| `jobs` | Collection `Job` | Root entity |
| `stageEvents` | Embedded `StageEvent[]` in `Job` | Always queried with job, bounded size |
| `tasks` | Embedded `ApplicationTask[]` in `Job` | Always queried with job, bounded size |
| `interviews` | Embedded `Interview[]` in `Job` | Always queried with job |
| `tracerLinks` | Embedded `TracerLink[]` in `Job` | Tight 1:1 relationship |
| `tracerClickEvents` | Collection `TracerClickEvent` | Unbounded volume, analytics queries |
| `pipelineRuns` | Collection `PipelineRun` | Independent audit trail |
| `jobChatThreads` | Collection `ChatThread` | |
| `jobChatMessages` | Embedded `ChatMessage[]` in `ChatThread` | Always fetched with thread |
| `jobChatRuns` | Collection `ChatRun` | Execution audit |
| `settings` | Collection `Settings` (singleton) | Single document, key-value |
| `postApplicationIntegrations` | Collection `PostApplicationIntegration` | |
| `postApplicationSyncRuns` | Embedded `SyncRun[]` in integration | Bounded, always together |
| `postApplicationMessages` | Collection `PostApplicationMessage` | Unbounded, independent queries |

### 1.2 Prisma v7 Schema

```prisma
// job-ops-migration/apps/web/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

// ─── Embedded Types ────────────────────────────────────────────────────────────

type StageEvent {
  id        String   @db.ObjectId
  stage     String
  timestamp DateTime
  note      String?
}

type ApplicationTask {
  id          String    @db.ObjectId
  type        String    // prep | todo | follow_up | check_status
  title       String
  dueDate     DateTime?
  completedAt DateTime?
  createdAt   DateTime  @default(now())
}

type InterviewRecord {
  id          String    @db.ObjectId
  type        String    // recruiter_screen | technical | onsite | panel | behavioral | final
  scheduledAt DateTime?
  completedAt DateTime?
  outcome     String?   // pass | fail | pending | cancelled
  notes       String?
  createdAt   DateTime  @default(now())
}

type TracerLink {
  id          String    @db.ObjectId
  token       String
  label       String?
  clickCount  Int       @default(0)
  lastClickAt DateTime?
  createdAt   DateTime  @default(now())
}

type ChatMessage {
  id        String   @db.ObjectId
  role      String   // user | assistant | system
  content   String
  createdAt DateTime @default(now())
}

type SyncRun {
  id           String    @db.ObjectId
  status       String    // running | completed | failed
  messagesFound Int      @default(0)
  startedAt    DateTime  @default(now())
  completedAt  DateTime?
  error        String?
}

// ─── Collections ───────────────────────────────────────────────────────────────

model Job {
  id                  String    @id @default(auto()) @map("_id") @db.ObjectId
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Source / discovery
  source              String
  externalId          String?
  url                 String?
  crawledAt           DateTime?

  // Core fields
  title               String
  employer            String?
  location            String?
  country             String?
  isRemote            Boolean   @default(false)
  jobType             String?   // full_time | part_time | contract | internship
  salaryMin           Float?
  salaryMax           Float?
  salaryCurrency      String?
  salaryPeriod        String?
  jobDescription      String?
  benefits            String?

  // Status
  status              String    @default("discovered")
  // discovered | processing | ready | applied | in_progress | skipped | expired

  // Scoring
  scoreOverall        Float?
  scoreReasoning      String?
  scoredAt            DateTime?

  // Tailoring
  tailoredSummary     String?
  tailoredHeadline    String?
  tailoredSkills      String?   // JSON array
  tailoredAt          DateTime?
  selectedProjectIds  String?   // JSON array

  // PDF
  pdfPath             String?
  pdfStorageKey       String?   // DO Spaces object key
  pdfPublicUrl        String?
  pdfGeneratedAt      DateTime?

  // Application tracking
  applicationStage    String?
  applicationOutcome  String?
  appliedAt           DateTime?
  applicationUrl      String?
  applicationNote     String?
  deadline            DateTime?

  // Tracer
  tracerLinksEnabled  Boolean   @default(false)

  // JobSpy enrichment fields
  companyIndustry     String?
  companyUrl          String?
  companyLogo         String?
  companySector       String?
  companyRevenue      String?
  companyEmployees    String?
  linkedinId          String?
  indeedId            String?
  glassdoorId         String?
  emails              String?   // JSON array
  personName          String?
  visaSponsor         Boolean?

  // Embedded child documents
  stageEvents         StageEvent[]
  tasks               ApplicationTask[]
  interviews          InterviewRecord[]
  tracerLinks         TracerLink[]

  // Relations
  chatThreads         ChatThread[]
  clickEvents         TracerClickEvent[]

  @@index([status])
  @@index([crawledAt])
  @@index([employer])
  @@map("jobs")
}

model TracerClickEvent {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  jobId      String   @db.ObjectId
  linkToken  String
  ip         String?
  userAgent  String?
  referrer   String?
  clickedAt  DateTime @default(now())

  job        Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
  @@index([linkToken])
  @@map("tracer_click_events")
}

model PipelineRun {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  status        String    // running | completed | failed | partial
  triggeredBy   String    // scheduler | manual | webhook
  startedAt     DateTime  @default(now())
  completedAt   DateTime?
  jobsFound     Int       @default(0)
  jobsScored    Int       @default(0)
  jobsSkipped   Int       @default(0)
  error         String?
  meta          Json?

  @@index([startedAt])
  @@map("pipeline_runs")
}

model ChatThread {
  id        String        @id @default(auto()) @map("_id") @db.ObjectId
  jobId     String        @db.ObjectId
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  messages  ChatMessage[]

  job       Job           @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
  @@map("chat_threads")
}

model ChatRun {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  threadId    String    @db.ObjectId
  jobId       String    @db.ObjectId
  status      String    // running | completed | failed
  model       String
  promptTokens  Int?
  outputTokens  Int?
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  error       String?

  @@index([threadId])
  @@map("chat_runs")
}

model Settings {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  // Enforced singleton: application code always queries the first document.
  // Key: setting name, Value: JSON-serialised value.
  data      Json     @default("{}")
  updatedAt DateTime @updatedAt

  @@map("settings")
}

model PostApplicationIntegration {
  id           String    @id @default(auto()) @map("_id") @db.ObjectId
  provider     String    // gmail
  status       String    // not_configured | connecting | connected | disconnected
  email        String?
  accessToken  String?   // stored encrypted
  refreshToken String?   // stored encrypted
  tokenExpiry  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  syncRuns     SyncRun[]
  messages     PostApplicationMessage[]

  @@map("post_application_integrations")
}

model PostApplicationMessage {
  id              String    @id @default(auto()) @map("_id") @db.ObjectId
  integrationId   String    @db.ObjectId
  externalId      String    // Gmail message ID
  subject         String?
  fromAddress     String?
  receivedAt      DateTime?
  classification  String?   // interview_invite | rejection | offer | follow_up | other
  relevance       String?   // high | medium | low
  linkedJobId     String?   @db.ObjectId
  approved        Boolean?
  reviewedAt      DateTime?
  rawSnippet      String?
  createdAt       DateTime  @default(now())

  integration     PostApplicationIntegration @relation(fields: [integrationId], references: [id], onDelete: Cascade)

  @@index([integrationId])
  @@index([linkedJobId])
  @@index([receivedAt])
  @@map("post_application_messages")
}
```

### 1.3 Schema Push Command

```bash
# From job-ops-migration/apps/web/
npx prisma db push           # Apply schema to running MongoDB
npx prisma generate          # Regenerate Prisma client types
```

> Never run `prisma migrate` — it is not supported for MongoDB. Record all schema changes
> in `prisma/SCHEMA_CHANGELOG.md` with date and reason.

---

## Phase 2 — Infrastructure

### 2.1 Docker Compose

```yaml
# job-ops-migration/docker-compose.yml
version: "3.9"

services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER:-jobops}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD:?required}
      MONGO_INITDB_DATABASE: jobops
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"         # Expose only during development; remove in production
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    restart: unless-stopped
    depends_on:
      mongo:
        condition: service_healthy
      extractor:
        condition: service_started
    ports:
      - "3005:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: mongodb://${MONGO_USER:-jobops}:${MONGO_PASSWORD}@mongo:27017/jobops?authSource=admin
      DO_SPACES_ENDPOINT: ${DO_SPACES_ENDPOINT}
      DO_SPACES_KEY: ${DO_SPACES_KEY}
      DO_SPACES_SECRET: ${DO_SPACES_SECRET}
      DO_SPACES_BUCKET: ${DO_SPACES_BUCKET}
      DO_SPACES_CDN_URL: ${DO_SPACES_CDN_URL:-}
      EXTRACTOR_URL: http://extractor:8000
      BASIC_AUTH_USER: ${BASIC_AUTH_USER:-}
      BASIC_AUTH_PASSWORD: ${BASIC_AUTH_PASSWORD:-}
    volumes:
      - web_data:/app/data     # Only used for legacy fallback; primary storage is DO Spaces
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  extractor:
    build:
      context: services/extractor
    restart: unless-stopped
    environment:
      HOST: 0.0.0.0
      PORT: 8000
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  mongo_data:
  web_data:
```

### 2.2 Environment Variables

```bash
# job-ops-migration/.env.example

# MongoDB (Docker Compose)
MONGO_USER=jobops
MONGO_PASSWORD=changeme
DATABASE_URL=mongodb://jobops:changeme@mongo:27017/jobops?authSource=admin

# DigitalOcean Spaces (S3-compatible)
DO_SPACES_ENDPOINT=https://<region>.digitaloceanspaces.com
DO_SPACES_KEY=<access-key-id>
DO_SPACES_SECRET=<secret-access-key>
DO_SPACES_BUCKET=jobops-resumes
DO_SPACES_CDN_URL=https://<bucket>.<region>.cdn.digitaloceanspaces.com  # optional CDN

# LLM
LLM_API_KEY=
MODEL=google/gemini-flash-1.5

# RxResume
RXRESUME_URL=https://v4.rxresu.me
RXRESUME_EMAIL=
RXRESUME_PASSWORD=

# Auth (optional)
BASIC_AUTH_USER=
BASIC_AUTH_PASSWORD=

# Gmail OAuth
GMAIL_OAUTH_CLIENT_ID=
GMAIL_OAUTH_CLIENT_SECRET=
GMAIL_OAUTH_REDIRECT_URI=

# Public URL (for tracer links)
JOBOPS_PUBLIC_BASE_URL=https://jobops.example.com

# Extractor sidecar
EXTRACTOR_URL=http://extractor:8000

# Adzuna
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
```

### 2.3 DigitalOcean Spaces — Storage Provider

```ts
// apps/web/src/lib/server/services/storage/do-spaces.ts
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "./provider.js";

export class DOSpacesProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private cdnUrl: string | null;

  constructor() {
    this.bucket = process.env.DO_SPACES_BUCKET!;
    this.cdnUrl = process.env.DO_SPACES_CDN_URL ?? null;
    this.client = new S3Client({
      endpoint: process.env.DO_SPACES_ENDPOINT,
      region: "us-east-1",           // Required by SDK but overridden by endpoint
      credentials: {
        accessKeyId: process.env.DO_SPACES_KEY!,
        secretAccessKey: process.env.DO_SPACES_SECRET!,
      },
    });
  }

  async write(key: string, stream: NodeJS.ReadableStream, contentType = "application/pdf"): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: Buffer.concat(chunks),
      ContentType: contentType,
      ACL: "private",
    }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async signedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }

  publicUrl(key: string): string {
    return this.cdnUrl ? `${this.cdnUrl}/${key}` : `${process.env.DO_SPACES_ENDPOINT}/${this.bucket}/${key}`;
  }
}
```

```ts
// apps/web/src/lib/server/services/storage/provider.ts
export interface StorageProvider {
  write(key: string, stream: NodeJS.ReadableStream, contentType?: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  signedDownloadUrl(key: string, expiresIn?: number): Promise<string>;
  publicUrl(key: string): string;
}

// apps/web/src/lib/server/services/storage/index.ts
import { DOSpacesProvider } from "./do-spaces.js";

let _provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!_provider) _provider = new DOSpacesProvider();
  return _provider;
}
```

**PDF download route** (`/pdfs/[jobId]/+server.ts`):
```ts
import type { RequestHandler } from "./$types";
import { getPrisma } from "$lib/server/db/index.js";
import { getStorageProvider } from "$lib/server/services/storage/index.js";

export const GET: RequestHandler = async ({ params }) => {
  const job = await getPrisma().job.findUnique({ where: { id: params.jobId } });
  if (!job?.pdfStorageKey) return new Response("Not found", { status: 404 });

  const storage = getStorageProvider();
  const url = await storage.signedDownloadUrl(job.pdfStorageKey, 60);

  // Redirect to a short-lived signed URL — browser handles the download
  return Response.redirect(url, 302);
};
```

---

## Phase 3 — tRPC Routers

### 3.1 tRPC Setup

```ts
// apps/web/src/lib/server/trpc/context.ts
import type { RequestEvent } from "@sveltejs/kit";
import { getPrisma } from "../db/index.js";

export async function createContext(event: RequestEvent) {
  return {
    prisma: getPrisma(),
    requestId: event.request.headers.get("x-request-id") ?? crypto.randomUUID(),
    event,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

```ts
// apps/web/src/lib/server/trpc/init.ts
import { initTRPC } from "@trpc/server";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
```

### 3.2 Router Structure

```ts
// apps/web/src/lib/server/trpc/routers/_app.ts
import { router } from "../init.js";
import { jobsRouter } from "./jobs.js";
import { pipelineRouter } from "./pipeline.js";
import { settingsRouter } from "./settings.js";
import { postApplicationRouter } from "./post-application.js";
import { tracerRouter } from "./tracer.js";
import { chatRouter } from "./chat.js";
import { backupRouter } from "./backup.js";

export const appRouter = router({
  jobs: jobsRouter,
  pipeline: pipelineRouter,
  settings: settingsRouter,
  postApplication: postApplicationRouter,
  tracer: tracerRouter,
  chat: chatRouter,
  backup: backupRouter,
});

export type AppRouter = typeof appRouter;
```

### 3.3 Jobs Router (representative example)

```ts
// apps/web/src/lib/server/trpc/routers/jobs.ts
import { z } from "zod";
import { router, publicProcedure } from "../init.js";
import { TRPCError } from "@trpc/server";

export const jobsRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const { status, page, pageSize } = input;
      const [jobs, total] = await Promise.all([
        ctx.prisma.job.findMany({
          where: status ? { status } : undefined,
          orderBy: { crawledAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          // Select only list-view fields (mirrors legacy JobListItem)
          select: {
            id: true, title: true, employer: true, location: true, status: true,
            scoreOverall: true, crawledAt: true, appliedAt: true, source: true,
            isRemote: true, salaryMin: true, salaryMax: true, salaryCurrency: true,
            pdfPublicUrl: true, applicationStage: true,
          },
        }),
        ctx.prisma.job.count({ where: status ? { status } : undefined }),
      ]);
      return { jobs, total, page, pageSize };
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.id } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      return job;
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      data: z.object({
        status: z.string().optional(),
        applicationStage: z.string().optional(),
        applicationNote: z.string().optional(),
        applicationOutcome: z.string().optional(),
        tracerLinksEnabled: z.boolean().optional(),
        selectedProjectIds: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.job.update({ where: { id: input.id }, data: input.data });
    }),

  bulkAction: publicProcedure
    .input(z.object({
      ids: z.array(z.string()),
      action: z.enum(["move_to_ready", "rescore", "skip", "delete"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Dispatch to pipeline service; returns immediately
      // Progress streamed via SSE endpoint (/api/pipeline/stream)
      const { dispatchBulkAction } = await import("../../services/pipeline/bulk.js");
      return dispatchBulkAction(input.ids, input.action, ctx.prisma);
    }),

  generatePdf: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { generateFinalPdf } = await import("../../services/pdf/index.js");
      const result = await generateFinalPdf(input.id, ctx.prisma);
      if (!result.success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      return ctx.prisma.job.findUnique({ where: { id: input.id } });
    }),
});
```

### 3.4 tRPC SvelteKit Handler

```ts
// apps/web/src/routes/api/trpc/[trpc]/+server.ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "$lib/server/trpc/routers/_app.js";
import { createContext } from "$lib/server/trpc/context.js";
import type { RequestHandler } from "./$types";

const handler: RequestHandler = (event) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req: event.request,
    router: appRouter,
    createContext: () => createContext(event),
  });

export const GET = handler;
export const POST = handler;
```

### 3.5 Client-Side tRPC Hook

```ts
// apps/web/src/lib/trpc/client.ts
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "$lib/server/trpc/routers/_app.js";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({ url: "/api/trpc" }),
  ],
});
```

---

## Phase 4 — Python Extractor Sidecar

The existing `extractors/jobspy/scrape_jobs.py` is adapted to run behind a FastAPI HTTP
server rather than being invoked as a subprocess.

### 4.1 FastAPI Wrapper

```python
# job-ops-migration/services/extractor/http_server.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
from scrape_jobs import scrape  # adapted core function from legacy scrape_jobs.py

app = FastAPI()

class ScrapeRequest(BaseModel):
    search_terms: list[str]
    location: str
    country: str = "USA"
    is_remote: bool = False
    results_wanted: int = 50
    sites: list[str] = ["linkedin", "indeed", "glassdoor"]

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/scrape")
async def scrape_jobs(req: ScrapeRequest):
    try:
        loop = asyncio.get_event_loop()
        jobs = await loop.run_in_executor(None, scrape, req.dict())
        return {"ok": True, "data": jobs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 4.2 Node HTTP Client

```ts
// apps/web/src/lib/server/extractors/jobspy.ts
import { logger } from "../infra/logger.js";

export interface JobSpyScrapeOptions {
  searchTerms: string[];
  location: string;
  country: string;
  isRemote: boolean;
  resultsWanted: number;
  sites?: string[];
}

export async function scrapeJobSpy(options: JobSpyScrapeOptions): Promise<RawJob[]> {
  const url = `${process.env.EXTRACTOR_URL}/scrape`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      search_terms: options.searchTerms,
      location: options.location,
      country: options.country,
      is_remote: options.isRemote,
      results_wanted: options.resultsWanted,
      sites: options.sites ?? ["linkedin", "indeed", "glassdoor"],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error({ status: res.status, body: text.slice(0, 200) }, "Extractor request failed");
    throw new Error(`Extractor returned ${res.status}`);
  }

  const body = await res.json();
  return body.data as RawJob[];
}
```

---

## Phase 5 — SvelteKit Frontend

### 5.1 svelte.config.js

```js
// apps/web/svelte.config.js
import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ out: "build" }),
    alias: {
      $lib: "./src/lib",
    },
  },
};
```

### 5.2 Route Layout — App Shell

```svelte
<!-- apps/web/src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import Sidebar from "$lib/components/Sidebar.svelte";
  import { page } from "$app/stores";
</script>

<div class="flex h-screen overflow-hidden bg-background">
  <Sidebar currentPath={$page.url.pathname} />
  <main class="flex-1 overflow-y-auto">
    <slot />
  </main>
</div>
```

### 5.3 Jobs Page (SSR load + client reactivity)

```ts
// apps/web/src/routes/(app)/jobs/+page.server.ts
import type { PageServerLoad } from "./$types";
import { trpcServer } from "$lib/server/trpc/server.js";

export const load: PageServerLoad = async (event) => {
  const trpc = trpcServer(event);
  const { jobs, total } = await trpc.jobs.list({ status: "ready" });
  return { jobs, total };
};
```

```svelte
<!-- apps/web/src/routes/(app)/jobs/+page.svelte -->
<script lang="ts">
  import { trpc } from "$lib/trpc/client.js";
  import JobCard from "$lib/components/JobCard.svelte";
  import type { PageData } from "./$types";

  export let data: PageData;

  let status = "ready";
  let jobs = data.jobs;

  async function refetch() {
    const result = await trpc.jobs.list.query({ status });
    jobs = result.jobs;
  }
</script>

<div class="p-6 space-y-4">
  {#each jobs as job (job.id)}
    <JobCard {job} on:action={refetch} />
  {/each}
</div>
```

### 5.4 SSE for Pipeline Progress

SvelteKit's streaming responses replace the legacy Express SSE helpers:

```ts
// apps/web/src/routes/api/pipeline/stream/+server.ts
import type { RequestHandler } from "./$types";
import { getPipelineEventEmitter } from "$lib/server/services/pipeline/events.js";

export const GET: RequestHandler = ({ request }) => {
  const emitter = getPipelineEventEmitter();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      emitter.on("progress", (payload) => send("progress", payload));
      emitter.on("complete", (payload) => { send("complete", payload); controller.close(); });
      emitter.on("error", (err) => { send("error", { message: err.message }); controller.close(); });

      request.signal.addEventListener("abort", () => controller.close());
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
};
```

---

## Phase 6 — Tooling (ESLint + Vitest + Playwright)

### 6.1 ESLint Configuration

```js
// apps/web/eslint.config.js
import js from "@eslint/js";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import svelteParser from "svelte-eslint-parser";
import globals from "globals";

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs["flat/recommended"],
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parser: svelteParser,
      parserOptions: { parser: ts.parser },
    },
  },
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: ["build/", ".svelte-kit/", "node_modules/"],
  },
];
```

### 6.2 Vitest Configuration

```ts
// apps/web/vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}", "tests/unit/**/*.{test,spec}.{js,ts}"],
    globals: true,
    environment: "node",             // Server-side logic; use jsdom only for component tests
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**"],
      exclude: ["src/lib/components/**"],  // UI tested via Playwright
    },
  },
});
```

### 6.3 Unit Test Pattern (tRPC router)

```ts
// tests/unit/trpc/jobs.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createCallerFactory } from "@trpc/server";
import { appRouter } from "$lib/server/trpc/routers/_app.js";
import { mockPrisma } from "../../mocks/prisma.js";

const createCaller = createCallerFactory(appRouter);

describe("jobs.list", () => {
  let caller: ReturnType<typeof createCaller>;

  beforeEach(() => {
    caller = createCaller({
      prisma: mockPrisma,
      requestId: "test-req-id",
      event: {} as never,
    });
  });

  it("returns jobs filtered by status", async () => {
    mockPrisma.job.findMany.mockResolvedValue([{ id: "1", title: "Engineer", status: "ready" }] as never);
    mockPrisma.job.count.mockResolvedValue(1);

    const result = await caller.jobs.list({ status: "ready" });

    expect(result.jobs).toHaveLength(1);
    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "ready" } })
    );
  });
});
```

### 6.4 Integration Test Pattern (real MongoDB)

```ts
// tests/integration/trpc/jobs.test.ts
// Uses mongodb-memory-server for a real MongoDB instance in CI
import { MongoMemoryServer } from "mongodb-memory-server";
import { PrismaClient } from "@prisma/client";
import { createCallerFactory } from "@trpc/server";
import { appRouter } from "$lib/server/trpc/routers/_app.js";

let mongod: MongoMemoryServer;
let prisma: PrismaClient;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  prisma = new PrismaClient({ datasources: { db: { url: mongod.getUri() } } });
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
  await mongod.stop();
});

it("creates and retrieves a job", async () => {
  const caller = createCallerFactory(appRouter)({ prisma, requestId: "int-test", event: {} as never });
  // Insert via prisma directly, query via tRPC
  await prisma.job.create({ data: { title: "Test Job", source: "manual", status: "discovered" } });
  const result = await caller.jobs.list({});
  expect(result.jobs[0].title).toBe("Test Job");
});
```

### 6.5 Playwright E2E Configuration

```ts
// apps/web/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://localhost:4173",   // preview server
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
```

```ts
// tests/e2e/jobs.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Job list", () => {
  test("displays ready jobs on load", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page.getByRole("heading", { name: /jobs/i })).toBeVisible();
  });

  test("download button triggers PDF download", async ({ page }) => {
    await page.goto("/jobs");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: /download pdf/i }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
```

---

## Phase 7 — packages.json & Dependencies

```json
{
  "name": "job-ops-web",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node build",
    "db:push": "prisma db push",
    "db:generate": "prisma generate",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:types": "tsc --noEmit"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3",
    "@aws-sdk/s3-request-presigner": "^3",
    "@prisma/client": "^7",
    "@sveltejs/kit": "^2",
    "@trpc/client": "^11",
    "@trpc/server": "^11",
    "zod": "^3"
  },
  "devDependencies": {
    "@eslint/js": "^9",
    "@playwright/test": "^1",
    "@sveltejs/adapter-node": "^5",
    "@sveltejs/vite-plugin-svelte": "^4",
    "eslint": "^9",
    "eslint-plugin-svelte": "^2",
    "mongodb-memory-server": "^10",
    "prisma": "^7",
    "svelte": "^5",
    "svelte-check": "^4",
    "typescript": "^5",
    "typescript-eslint": "^8",
    "vitest": "^2"
  }
}
```

---

## Implementation Phases & Order

| Phase | Deliverable | Tests required |
|---|---|---|
| **1** | Prisma schema + `db push` to local MongoDB | Integration: CRUD on all collections |
| **2** | Docker Compose (mongo + web + extractor) | Health check endpoints |
| **3** | DO Spaces `StorageProvider` | Unit: mock S3, Integration: upload/download/exists |
| **4** | tRPC routers (jobs, settings, pipeline) | Unit per router, integration against in-memory Mongo |
| **5** | Python sidecar FastAPI wrapper | Integration: POST /scrape returns shaped jobs |
| **6** | SvelteKit app scaffold (layout, routing) | Playwright: page loads, navigation |
| **7** | Jobs page + job detail page | Playwright: list renders, detail opens |
| **8** | Settings page | Playwright: settings save round-trip |
| **9** | Pipeline SSE + progress UI | Vitest: event emitter, Playwright: progress bar |
| **10** | PDF generation + DO Spaces upload | Integration: generate → upload → signed URL |
| **11** | Post-application / Gmail tracking | Unit: email classifier, Integration: sync run |
| **12** | Full E2E suite + CI pipeline | All Playwright specs green |

---

## CI Pipeline (GitHub Actions sketch)

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - run: npm ci
      - run: npm run lint
      - run: npm run check:types

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - run: npm ci
      - run: npm run test:run   # Vitest unit + integration (uses mongodb-memory-server)

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: docker compose -f docker-compose.yml up -d mongo extractor
      - run: npm run test:e2e
```

---

## Legacy Reference

The existing codebase at the **repo root** remains untouched. Key files to reference during
implementation:

| Legacy file | What to port |
|---|---|
| `orchestrator/src/server/db/schema.ts` | Field names, types, indexes → Prisma schema |
| `orchestrator/src/server/services/pdf.ts` | Generation logic, RxResume flow |
| `orchestrator/src/server/services/llm/` | Provider implementations |
| `orchestrator/src/server/pipeline/orchestrator.ts` | Job lifecycle state machine |
| `orchestrator/src/server/api/routes/jobs.ts` | Business rules for each operation → tRPC router |
| `shared/src/types/jobs.ts` | Job status/stage enums, re-export from `shared/` |
| `extractors/jobspy/scrape_jobs.py` | Core scrape logic for FastAPI wrapper |
| `AGENTS.md` | Response contract, logging, redaction rules (apply to tRPC context) |
