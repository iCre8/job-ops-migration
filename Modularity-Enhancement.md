# Modularity Enhancement Plan

Enhancements to the existing Job-Ops stack (`orchestrator/`) to decouple core concerns and
make each layer independently testable and swappable — without a full rewrite.

---

## 1. Pluggable Storage Backend

**Problem:** PDFs are hardcoded to local disk in `orchestrator/src/server/services/pdf.ts:21`.
On a multi-instance deployment or when disk fills up, there is no swap path.

**Proposed interface:**

```ts
// orchestrator/src/server/services/storage/provider.ts
export interface StorageProvider {
  write(key: string, stream: NodeJS.ReadableStream): Promise<void>;
  readStream(key: string): Promise<NodeJS.ReadableStream>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}
```

**Implementations to create:**

| Class | Location | When used |
|---|---|---|
| `LocalStorageProvider` | `storage/local.ts` | Default (current behaviour) |
| `S3StorageProvider` | `storage/s3.ts` | When `STORAGE_PROVIDER=s3` |
| `DOSpacesProvider` | `storage/do-spaces.ts` | Extends S3 provider, DO-specific endpoint |

**Factory resolution** (`storage/index.ts`):
```ts
export function createStorageProvider(): StorageProvider {
  const p = process.env.STORAGE_PROVIDER ?? "local";
  if (p === "s3") return new S3StorageProvider();
  if (p === "do-spaces") return new DOSpacesStorageProvider();
  return new LocalStorageProvider(getDataDir());
}
```

The `generatePdf` function then receives a `StorageProvider` instance rather than calling `fs`
directly. The `/pdfs` static route is replaced with a signed-URL redirect when using a remote
provider.

**Tests:** Unit-test each provider against a common behaviour contract using Vitest with a
mock S3 server (e.g. `@aws-sdk/s3-request-presigner` + `vitest-mock-extended`).

---

## 2. Extractor Plugin Registry (Autodiscovery)

**Problem:** Each extractor is manually registered. Adding a new board requires editing the
registry file, not just dropping in a new module.

**Proposed contract** (already close to what exists in `shared/`):

```ts
// shared/src/types/extractor.ts
export interface ExtractorPlugin {
  id: string;                          // e.g. "gradcracker"
  displayName: string;
  configSchema: ZodSchema;             // validated at startup
  run(config: unknown): Promise<RawJob[]>;
}
```

**Autodiscovery loader** (`server/extractors/loader.ts`):
```ts
// Scans extractors/*/index.ts, imports default export, validates it satisfies ExtractorPlugin
export async function loadExtractors(): Promise<ExtractorPlugin[]>
```

Each extractor's `index.ts` just exports `default satisfies ExtractorPlugin`. No central
registry file to maintain. Startup validation surfaces misconfigured extractors before the
pipeline runs.

**Impact:** New board = new folder. No registry edit, no restart of unrelated services.

---

## 3. LLM Provider Factory

**Problem:** Provider selection logic is distributed across callers in `services/llm/`. There
is no single place to swap or mock the active provider in tests.

**Proposed pattern:**

```ts
// server/services/llm/provider.ts
export interface LLMProvider {
  complete(prompt: string, options: LLMOptions): Promise<string>;
  stream(prompt: string, options: LLMOptions): AsyncIterable<string>;
  modelId: string;
}

// server/services/llm/factory.ts
export function createLLMProvider(settings: AppSettings): LLMProvider {
  const { provider, model, apiKey } = resolveProviderConfig(settings);
  switch (provider) {
    case "openrouter": return new OpenRouterProvider(apiKey, model);
    case "openai":     return new OpenAIProvider(apiKey, model);
    case "gemini":     return new GeminiProvider(apiKey, model);
    default:           throw new Error(`Unknown provider: ${provider}`);
  }
}
```

All services (scorer, tailor, project-selector) receive an `LLMProvider` instance via
dependency injection rather than importing a provider directly. In tests, swap to a
`MockLLMProvider` returning fixture strings.

---

## 4. Resume Template Selection per Job

**Problem:** One resume template per RxResume account. No per-job template override.

**Data change:** Add `templateId: text("template_id")` to the `jobs` table (nullable).

**Settings change:** Add `availableTemplates: ResumeTemplate[]` to `AppSettings`:
```ts
export interface ResumeTemplate {
  id: string;          // RxResume resume ID used as template
  label: string;       // "Software Engineering", "Product"
  isDefault: boolean;
}
```

**Service change** (`services/pdf.ts`): `generatePdf` reads `job.templateId`, falls back to
the default template from settings. The RxResume `importResume` call receives the chosen base
template ID.

**UI change:** Job detail page exposes a template selector dropdown alongside the tailor
button, pre-populated from `AppSettings.availableTemplates`.

---

## 5. Per-Extractor Configuration Schema Validation

**Problem:** Extractor config (search terms, location, remote flag) is stored as loose JSON
in settings. Misconfiguration surfaces only at pipeline run time as a runtime error.

**Fix:** Each `ExtractorPlugin` exports a `configSchema: ZodSchema`. At app startup
(`server/index.ts`) and on the settings `PATCH` endpoint, validate extractor configs against
their schemas:

```ts
for (const extractor of await loadExtractors()) {
  const raw = settings[extractor.id + "Config"];
  const result = extractor.configSchema.safeParse(raw);
  if (!result.success) {
    logger.warn({ extractor: extractor.id, errors: result.error.flatten() },
      "Extractor config invalid — skipping");
  }
}
```

The settings UI can generate form fields from the Zod schema (using `zod-to-json-schema` +
a generic form renderer) so each extractor gets a validated config editor automatically.

---

## 6. Standardised `Content-Disposition` for PDF Downloads

**Problem:** The download filename (`PersonName_EmployerName.pdf`) is assembled in the
React frontend at `ReadyPanel.tsx:384`. Any non-browser client (API, automation script)
gets an unnamed file.

**Fix:** Move filename logic to the backend. In `app.ts`, replace the generic static
middleware for `/pdfs` with a thin route handler:

```ts
app.get("/pdfs/resume_:jobId.pdf", async (req, res) => {
  const job = await jobsRepo.getJobById(req.params.jobId);
  if (!job) return res.status(404).end();

  const filename = `${safe(job.personName)}_${safe(job.employer)}.pdf`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "application/pdf");

  const provider = createStorageProvider();
  const stream = await provider.readStream(`resume_${job.id}.pdf`);
  stream.pipe(res);
});
```

The frontend `<a download>` attribute remains but the server-set `Content-Disposition`
takes precedence, ensuring consistent filenames for all clients.

---

## Priority Order

| # | Enhancement | Effort | Impact |
|---|---|---|---|
| 1 | Storage backend abstraction | Medium | Unblocks cloud hosting |
| 6 | `Content-Disposition` fix | Low | Immediate DX improvement |
| 3 | LLM provider factory | Medium | Unblocks proper unit testing |
| 2 | Extractor autodiscovery | Medium | Reduces maintenance overhead |
| 5 | Config schema validation | Low | Prevents runtime surprises |
| 4 | Template selection | High | New user-facing feature |
