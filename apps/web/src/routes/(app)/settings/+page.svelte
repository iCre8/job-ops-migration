<script lang="ts">
  import { trpc } from "$lib/trpc/client.js";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
  const s = data.settings as Record<string, unknown>;

  // ── LLM ─────────────────────────────────────────────────────────────────────
  let llmProvider    = $state((s.llmProvider    as string)  ?? "openrouter");
  let llmModel       = $state((s.llmModel       as string)  ?? "");
  let llmApiKey      = $state((s.llmApiKey      as string)  ?? "");
  let llmEndpoint    = $state((s.llmEndpoint    as string)  ?? "");
  let llmValidating  = $state(false);
  let llmValidResult = $state<{ ok: boolean; error?: string } | null>(null);

  // ── Job Search ───────────────────────────────────────────────────────────────
  let searchTerms    = $state((s.searchTerms    as string)  ?? "");
  let searchLocation = $state((s.searchLocation as string)  ?? "");
  let searchCountry  = $state((s.searchCountry  as string)  ?? "");
  let searchRemote   = $state((s.searchRemote   as boolean) ?? false);
  let resultsWanted  = $state((s.resultsWanted  as number)  ?? 25);

  // ── Scoring & Filtering ──────────────────────────────────────────────────────
  let scoreThreshold      = $state((s.scoreThreshold      as number)  ?? 60);
  let autoSkipBelow       = $state((s.autoSkipBelow       as number)  ?? 30);
  let blockedKeywords     = $state((s.blockedKeywords     as string)  ?? "");
  let salaryPenaltyBelow  = $state((s.salaryPenaltyBelow  as number)  ?? 0);

  // ── Writing Style ────────────────────────────────────────────────────────────
  let writingTone        = $state((s.writingTone        as string)  ?? "professional");
  let writingFormality   = $state((s.writingFormality   as string)  ?? "formal");
  let writingConstraints = $state((s.writingConstraints as string)  ?? "");

  // ── Prompt Templates ─────────────────────────────────────────────────────────
  let promptGhostwriter = $state((s.promptGhostwriter as string) ?? "");
  let promptScorer      = $state((s.promptScorer      as string) ?? "");
  let promptTailoring   = $state((s.promptTailoring   as string) ?? "");

  // ── RxResume ─────────────────────────────────────────────────────────────────
  let rxResumeUrl   = $state((s.rxResumeUrl   as string) ?? "");
  let rxResumeEmail = $state((s.rxResumeEmail as string) ?? "");
  let rxResumePass  = $state((s.rxResumePass  as string) ?? "");
  let rxValidating  = $state(false);
  let rxValidResult = $state<{ ok: boolean; error?: string } | null>(null);

  // ── Webhooks ─────────────────────────────────────────────────────────────────
  let webhookPipeline   = $state((s.webhookPipeline   as string) ?? "");
  let webhookJobComplete = $state((s.webhookJobComplete as string) ?? "");

  // ── Display Preferences ──────────────────────────────────────────────────────
  let showSponsorBadges    = $state((s.showSponsorBadges    as boolean) ?? true);
  let enableMarkdownRender = $state((s.enableMarkdownRender as boolean) ?? true);
  let autoTailorOnApply    = $state((s.autoTailorOnApply    as boolean) ?? false);

  // ── Backups ──────────────────────────────────────────────────────────────────
  let backups     = $state(data.backups ?? []);
  let backupBusy  = $state(false);
  let backupErr   = $state("");

  // ── Save ─────────────────────────────────────────────────────────────────────
  let saving  = $state(false);
  let saved   = $state(false);
  let saveErr = $state("");

  // ── Active section ────────────────────────────────────────────────────────────
  let activeSection = $state("llm");

  const SECTIONS = [
    { id: "llm",      label: "AI Model" },
    { id: "search",   label: "Job Search" },
    { id: "scoring",  label: "Scoring Rules" },
    { id: "writing",  label: "Writing Style" },
    { id: "prompts",  label: "Prompt Templates" },
    { id: "rxresume", label: "RxResume" },
    { id: "webhooks", label: "Webhooks" },
    { id: "display",  label: "Display" },
    { id: "backups",  label: "Backups" },
    { id: "danger",   label: "Danger Zone" },
  ];

  async function save() {
    saving = true; saved = false; saveErr = "";
    try {
      await trpc.settings.update.mutate({
        llmProvider, llmModel, llmApiKey, llmEndpoint,
        searchTerms, searchLocation, searchCountry, searchRemote, resultsWanted,
        scoreThreshold, autoSkipBelow, blockedKeywords, salaryPenaltyBelow,
        writingTone, writingFormality, writingConstraints,
        promptGhostwriter, promptScorer, promptTailoring,
        rxResumeUrl, rxResumeEmail, rxResumePass,
        webhookPipeline, webhookJobComplete,
        showSponsorBadges, enableMarkdownRender, autoTailorOnApply,
      });
      saved = true;
      setTimeout(() => { saved = false; }, 3000);
    } catch (err) {
      saveErr = err instanceof Error ? err.message : "Save failed";
    } finally {
      saving = false;
    }
  }

  async function validateLlm() {
    llmValidating = true; llmValidResult = null;
    try {
      llmValidResult = await trpc.settings.validateLlm.mutate({
        provider: llmProvider as "openai" | "openrouter" | "anthropic" | "google" | "lm_studio",
        apiKey: llmApiKey || undefined,
        endpoint: llmEndpoint || undefined,
        model: llmModel || undefined,
      });
    } catch (e) {
      llmValidResult = { ok: false, error: e instanceof Error ? e.message : "Failed" };
    } finally {
      llmValidating = false;
    }
  }

  async function validateRxResume() {
    rxValidating = true; rxValidResult = null;
    try {
      rxValidResult = await trpc.settings.validateRxResume.mutate({
        url: rxResumeUrl, email: rxResumeEmail, password: rxResumePass,
      });
    } catch (e) {
      rxValidResult = { ok: false, error: e instanceof Error ? e.message : "Failed" };
    } finally {
      rxValidating = false;
    }
  }

  async function createBackup() {
    backupBusy = true; backupErr = "";
    try {
      const b = await trpc.settings.backups.create.mutate();
      backups = [b, ...backups];
    } catch (e) {
      backupErr = e instanceof Error ? e.message : "Failed";
    } finally {
      backupBusy = false;
    }
  }

  async function deleteBackup(id: string) {
    try {
      await trpc.settings.backups.delete.mutate({ id });
      backups = backups.filter((b: { id: string }) => b.id !== id);
    } catch (e) {
      backupErr = e instanceof Error ? e.message : "Failed";
    }
  }

  async function clearByStatus(status: string) {
    if (!confirm(`Delete all jobs with status "${status}"? This cannot be undone.`)) return;
    const r = await trpc.settings.database.clearByStatus.mutate({ status });
    alert(`Deleted ${r.deleted} jobs.`);
  }

  async function clearAll() {
    if (!confirm("Delete ALL jobs and pipeline runs? This cannot be undone.")) return;
    const r = await trpc.settings.database.clearAll.mutate();
    alert(`Deleted ${r.deletedJobs} jobs and ${r.deletedRuns} runs.`);
  }

  const inp = "padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;width:100%;box-sizing:border-box";
  const ta  = inp + ";min-height:90px;font-family:monospace;resize:vertical";
  const lbl = "display:flex;flex-direction:column;gap:0.375rem;font-size:0.875rem;font-weight:500";
</script>

<svelte:head><title>Settings — Job-Ops</title></svelte:head>

<div style="display:flex;min-height:100%;font-family:sans-serif">
  <!-- Sidebar nav -->
  <nav style="width:170px;flex-shrink:0;padding:1.5rem 0.75rem;border-right:1px solid #e5e7eb;background:#fafafa">
    <p style="font-size:0.7rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin:0 0 0.5rem 0.5rem">Settings</p>
    {#each SECTIONS as sec}
      <button onclick={() => { activeSection = sec.id; }}
        style="display:block;width:100%;text-align:left;padding:0.4rem 0.6rem;border:none;border-radius:5px;font-size:0.825rem;background:{activeSection === sec.id ? '#e0e7ff' : 'transparent'};color:{activeSection === sec.id ? '#4338ca' : '#374151'};font-weight:{activeSection === sec.id ? '600' : '400'};cursor:pointer;margin-bottom:2px">
        {sec.label}
      </button>
    {/each}
  </nav>

  <!-- Content -->
  <div style="flex:1;padding:2rem;max-width:700px;overflow-y:auto">

    <!-- ── AI Model ─────────────────────────────────────────────────────── -->
    {#if activeSection === "llm"}
      <h2 style="font-size:1.1rem;font-weight:700;margin:0 0 1.25rem">AI Model</h2>
      <div style="display:grid;gap:1rem">
        <label style={lbl}>Provider
          <select bind:value={llmProvider} style={inp}>
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google Gemini</option>
            <option value="lm_studio">LM Studio (local)</option>
          </select>
        </label>
        <label style={lbl}>Model <span style="font-weight:400;color:#9ca3af">(optional)</span>
          <input type="text" bind:value={llmModel} placeholder="e.g. openai/gpt-4o-mini" style={inp} />
        </label>
        <label style={lbl}>API Key
          <input type="password" bind:value={llmApiKey} placeholder="sk-…" autocomplete="off" style={inp} />
        </label>
        {#if llmProvider === "openai" || llmProvider === "lm_studio"}
          <label style={lbl}>API Endpoint <span style="font-weight:400;color:#9ca3af">(optional)</span>
            <input type="url" bind:value={llmEndpoint} placeholder={llmProvider === "lm_studio" ? "http://localhost:1234/v1" : "https://api.openai.com/v1"} style={inp} />
          </label>
        {/if}
        <div>
          <button onclick={validateLlm} disabled={llmValidating}
            style="padding:0.45rem 1rem;border:1px solid #d1d5db;background:#fff;border-radius:6px;font-size:0.875rem;cursor:{llmValidating?'wait':'pointer'}">
            {llmValidating ? "Testing…" : "Test Connection"}
          </button>
          {#if llmValidResult}
            <span style="margin-left:0.75rem;font-size:0.8rem;color:{llmValidResult.ok ? '#15803d' : '#dc2626'}">
              {llmValidResult.ok ? "✓ Connected" : "✗ " + (llmValidResult.error ?? "Failed")}
            </span>
          {/if}
        </div>
      </div>

    <!-- ── Job Search ───────────────────────────────────────────────────── -->
    {:else if activeSection === "search"}
      <h2 style="font-size:1.1rem;font-weight:700;margin:0 0 1.25rem">Job Search</h2>
      <div style="display:grid;gap:1rem">
        <label style={lbl}>Search terms <span style="font-weight:400;color:#9ca3af">(comma-separated)</span>
          <input type="text" bind:value={searchTerms} placeholder="Software Engineer, Backend Developer" style={inp} />
        </label>
        <label style={lbl}>Location
          <input type="text" bind:value={searchLocation} placeholder="London" style={inp} />
        </label>
        <label style={lbl}>Country code
          <input type="text" bind:value={searchCountry} placeholder="uk" style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;width:100px" />
        </label>
        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer">
          <input type="checkbox" bind:checked={searchRemote} /> Remote only
        </label>
        <label style={lbl}>Results wanted per term
          <input type="number" bind:value={resultsWanted} min="1" max="200" style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;width:100px" />
        </label>
      </div>

    <!-- ── Scoring Rules ─────────────────────────────────────────────────── -->
    {:else if activeSection === "scoring"}
      <h2 style="font-size:1.1rem;font-weight:700;margin:0 0 1.25rem">Scoring Rules</h2>
      <div style="display:grid;gap:1rem">
        <label style={lbl}>Score threshold — jobs below this score show a warning
          <input type="number" bind:value={scoreThreshold} min="0" max="100" style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;width:100px" />
        </label>
        <label style={lbl}>Auto-skip below score
          <input type="number" bind:value={autoSkipBelow} min="0" max="100" style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;width:100px" />
        </label>
        <label style={lbl}>Minimum salary (penalty below this value, 0 = disabled)
          <input type="number" bind:value={salaryPenaltyBelow} min="0" style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;width:140px" />
        </label>
        <label style={lbl}>Blocked keywords <span style="font-weight:400;color:#9ca3af">(comma-separated — jobs containing these are auto-skipped)</span>
          <input type="text" bind:value={blockedKeywords} placeholder="unpaid, commission, must relocate" style={inp} />
        </label>
      </div>

    <!-- ── Writing Style ─────────────────────────────────────────────────── -->
    {:else if activeSection === "writing"}
      <h2 style="font-size:1.1rem;font-weight:700;margin:0 0 1.25rem">Writing Style</h2>
      <div style="display:grid;gap:1rem">
        <label style={lbl}>Tone
          <select bind:value={writingTone} style={inp}>
            <option value="professional">Professional</option>
            <option value="confident">Confident</option>
            <option value="friendly">Friendly</option>
            <option value="concise">Concise</option>
          </select>
        </label>
        <label style={lbl}>Formality
          <select bind:value={writingFormality} style={inp}>
            <option value="formal">Formal</option>
            <option value="semi_formal">Semi-formal</option>
            <option value="casual">Casual</option>
          </select>
        </label>
        <label style={lbl}>Constraints <span style="font-weight:400;color:#9ca3af">(instructions always applied to AI writing)</span>
          <textarea bind:value={writingConstraints} placeholder="e.g. Never use passive voice. Keep sentences under 20 words." style={ta}></textarea>
        </label>
      </div>

    <!-- ── Prompt Templates ──────────────────────────────────────────────── -->
    {:else if activeSection === "prompts"}
      <h2 style="font-size:1.1rem;font-weight:700;margin:0 0 1.25rem">Prompt Templates</h2>
      <p style="font-size:0.8rem;color:#6b7280;margin:0 0 1rem">Leave blank to use built-in defaults.</p>
      <div style="display:grid;gap:1.25rem">
        <label style={lbl}>Ghostwriter system prompt
          <textarea bind:value={promptGhostwriter} placeholder="You are a career coach helping with job applications…" style={ta}></textarea>
        </label>
        <label style={lbl}>Scorer prompt additions
          <textarea bind:value={promptScorer} placeholder="Additional scoring criteria…" style={ta}></textarea>
        </label>
        <label style={lbl}>Resume tailoring prompt additions
          <textarea bind:value={promptTailoring} placeholder="Additional tailoring instructions…" style={ta}></textarea>
        </label>
      </div>

    <!-- ── RxResume ──────────────────────────────────────────────────────── -->
    {:else if activeSection === "rxresume"}
      <h2 style="font-size:1.1rem;font-weight:700;margin:0 0 1.25rem">Reactive Resume</h2>
      <div style="display:grid;gap:1rem">
        <label style={lbl}>RxResume URL
          <input type="url" bind:value={rxResumeUrl} placeholder="http://localhost:3100" style={inp} />
        </label>
        <label style={lbl}>Email
          <input type="email" bind:value={rxResumeEmail} style={inp} />
        </label>
        <label style={lbl}>Password
          <input type="password" bind:value={rxResumePass} autocomplete="off" style={inp} />
        </label>
        <div>
          <button onclick={validateRxResume} disabled={rxValidating || !rxResumeUrl}
            style="padding:0.45rem 1rem;border:1px solid #d1d5db;background:#fff;border-radius:6px;font-size:0.875rem;cursor:{rxValidating?'wait':'pointer'}">
            {rxValidating ? "Testing…" : "Test Connection"}
          </button>
          {#if rxValidResult}
            <span style="margin-left:0.75rem;font-size:0.8rem;color:{rxValidResult.ok ? '#15803d' : '#dc2626'}">
              {rxValidResult.ok ? "✓ Connected" : "✗ " + (rxValidResult.error ?? "Failed")}
            </span>
          {/if}
        </div>
      </div>

    <!-- ── Webhooks ──────────────────────────────────────────────────────── -->
    {:else if activeSection === "webhooks"}
      <h2 style="font-size:1.1rem;font-weight:700;margin:0 0 1.25rem">Webhooks</h2>
      <p style="font-size:0.8rem;color:#6b7280;margin:0 0 1rem">POSTed with JSON payload on each event. Leave blank to disable.</p>
      <div style="display:grid;gap:1rem">
        <label style={lbl}>Pipeline complete
          <input type="url" bind:value={webhookPipeline} placeholder="https://n8n.example.com/webhook/…" style={inp} />
        </label>
        <label style={lbl}>Job marked applied
          <input type="url" bind:value={webhookJobComplete} placeholder="https://n8n.example.com/webhook/…" style={inp} />
        </label>
      </div>

    <!-- ── Display ───────────────────────────────────────────────────────── -->
    {:else if activeSection === "display"}
      <h2 style="font-size:1.1rem;font-weight:700;margin:0 0 1.25rem">Display Preferences</h2>
      <div style="display:grid;gap:0.75rem">
        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer">
          <input type="checkbox" bind:checked={showSponsorBadges} /> Show visa sponsor badges on job cards
        </label>
        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer">
          <input type="checkbox" bind:checked={enableMarkdownRender} /> Render markdown in job descriptions
        </label>
        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer">
          <input type="checkbox" bind:checked={autoTailorOnApply} /> Auto-tailor resume when marking applied
        </label>
      </div>

    <!-- ── Backups ───────────────────────────────────────────────────────── -->
    {:else if activeSection === "backups"}
      <h2 style="font-size:1.1rem;font-weight:700;margin:0 0 1.25rem">Backups</h2>
      <button onclick={createBackup} disabled={backupBusy}
        style="margin-bottom:1rem;padding:0.5rem 1.25rem;background:#0070f3;color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:{backupBusy?'wait':'pointer'}">
        {backupBusy ? "Creating…" : "Create Backup Now"}
      </button>
      {#if backupErr}<p style="color:#dc2626;font-size:0.8rem">{backupErr}</p>{/if}
      {#if backups.length === 0}
        <p style="color:#9ca3af;font-size:0.875rem">No backups yet.</p>
      {:else}
        {#each backups as b (b.id)}
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.75rem;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:0.4rem">
            <div>
              <p style="font-size:0.875rem;margin:0;color:#111">{b.filename}</p>
              <p style="font-size:0.75rem;color:#9ca3af;margin:0">{(b.sizeBytes / 1024).toFixed(1)} KB · {new Date(b.createdAt).toLocaleString()}</p>
            </div>
            <button onclick={() => deleteBackup(b.id)}
              style="border:none;background:none;color:#dc2626;font-size:0.8rem;cursor:pointer">Delete</button>
          </div>
        {/each}
      {/if}

    <!-- ── Danger Zone ────────────────────────────────────────────────────── -->
    {:else if activeSection === "danger"}
      <h2 style="font-size:1.1rem;font-weight:700;margin:0 0 0.25rem;color:#dc2626">Danger Zone</h2>
      <p style="font-size:0.8rem;color:#6b7280;margin:0 0 1.25rem">These actions are permanent and cannot be undone.</p>
      <div style="border:1px solid #fecaca;border-radius:8px;padding:1.25rem;display:grid;gap:1rem">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem">
          <div>
            <p style="font-size:0.875rem;font-weight:600;margin:0">Clear skipped jobs</p>
            <p style="font-size:0.75rem;color:#6b7280;margin:0">Delete all jobs with status "skipped"</p>
          </div>
          <button onclick={() => clearByStatus("skipped")} style="padding:0.4rem 0.9rem;background:#dc2626;color:#fff;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer">Delete</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem">
          <div>
            <p style="font-size:0.875rem;font-weight:600;margin:0">Clear discovered jobs</p>
            <p style="font-size:0.75rem;color:#6b7280;margin:0">Delete all unscored discovered jobs</p>
          </div>
          <button onclick={() => clearByStatus("discovered")} style="padding:0.4rem 0.9rem;background:#dc2626;color:#fff;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer">Delete</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;border-top:1px solid #fecaca;padding-top:1rem">
          <div>
            <p style="font-size:0.875rem;font-weight:600;margin:0;color:#dc2626">Clear everything</p>
            <p style="font-size:0.75rem;color:#6b7280;margin:0">Delete all jobs, runs, and data</p>
          </div>
          <button onclick={clearAll} style="padding:0.4rem 0.9rem;background:#7f1d1d;color:#fff;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer">Delete All</button>
        </div>
      </div>
    {/if}

    <!-- Save bar (shown on all sections except backups/danger) -->
    {#if !["backups", "danger"].includes(activeSection)}
      <div style="margin-top:2rem;display:flex;align-items:center;gap:1rem;padding-top:1.5rem;border-top:1px solid #e5e7eb">
        <button onclick={save} disabled={saving}
          style="padding:0.6rem 1.5rem;background:{saving ? '#93c5fd' : '#2563eb'};color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:{saving ? 'wait' : 'pointer'}">
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {#if saved}<span style="font-size:0.875rem;color:#15803d">Saved.</span>{/if}
        {#if saveErr}<span style="font-size:0.875rem;color:#991b1b">{saveErr}</span>{/if}
      </div>
    {/if}

  </div>
</div>
