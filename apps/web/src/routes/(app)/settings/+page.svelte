<script lang="ts">
  import { trpc } from "$lib/trpc/client.js";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  // ── Field state (seeded from SSR) ─────────────────────────────────────────
  const s = data.settings as Record<string, unknown>;

  let llmProvider     = $state((s.llmProvider     as string)  ?? "openrouter");
  let llmModel        = $state((s.llmModel        as string)  ?? "");
  let llmApiKey       = $state((s.llmApiKey       as string)  ?? "");
  let searchTerms     = $state((s.searchTerms     as string)  ?? "");
  let searchLocation  = $state((s.searchLocation  as string)  ?? "");
  let searchCountry   = $state((s.searchCountry   as string)  ?? "");
  let searchRemote    = $state((s.searchRemote    as boolean) ?? false);
  let resultsWanted   = $state((s.resultsWanted   as number)  ?? 25);
  let rxResumeUrl     = $state((s.rxResumeUrl     as string)  ?? "");
  let rxResumeEmail   = $state((s.rxResumeEmail   as string)  ?? "");
  let rxResumePass    = $state((s.rxResumePass    as string)  ?? "");
  let scoreThreshold  = $state((s.scoreThreshold  as number)  ?? 60);

  // ── UI state ──────────────────────────────────────────────────────────────
  let saving  = $state(false);
  let saved   = $state(false);
  let saveErr = $state("");

  async function save() {
    saving  = true;
    saved   = false;
    saveErr = "";
    try {
      await trpc.settings.update.mutate({
        llmProvider,
        llmModel,
        llmApiKey,
        searchTerms,
        searchLocation,
        searchCountry,
        searchRemote,
        resultsWanted,
        rxResumeUrl,
        rxResumeEmail,
        rxResumePass,
        scoreThreshold,
      });
      saved = true;
      setTimeout(() => { saved = false; }, 3000);
    } catch (err) {
      saveErr = err instanceof Error ? err.message : "Save failed";
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Settings — Job-Ops</title>
</svelte:head>

<div style="padding:2rem;max-width:700px;margin:0 auto">
  <h1 style="font-size:1.5rem;font-weight:700;margin:0 0 0.25rem">Settings</h1>
  <p style="color:#6b7280;font-size:0.875rem;margin:0 0 2rem">
    Application configuration. Changes are saved to the database.
  </p>

  <!-- ── LLM ─────────────────────────────────────────────────────────────── -->
  <section style="margin-bottom:2rem">
    <h2 style="font-size:1rem;font-weight:600;margin:0 0 1rem;padding-bottom:0.5rem;border-bottom:1px solid #e5e7eb">
      LLM Provider
    </h2>

    <div style="display:grid;gap:1rem">
      <label style="display:flex;flex-direction:column;gap:0.375rem;font-size:0.875rem;font-weight:500">
        Provider
        <select
          bind:value={llmProvider}
          style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;background:#fff"
        >
          <option value="openrouter">OpenRouter</option>
          <option value="openai">OpenAI</option>
          <option value="gemini">Gemini</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </label>

      <label style="display:flex;flex-direction:column;gap:0.375rem;font-size:0.875rem;font-weight:500">
        Model
        <input
          type="text"
          bind:value={llmModel}
          placeholder="e.g. openai/gpt-4o"
          style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem"
        />
      </label>

      <label style="display:flex;flex-direction:column;gap:0.375rem;font-size:0.875rem;font-weight:500">
        API Key
        <input
          type="password"
          bind:value={llmApiKey}
          placeholder="sk-…"
          autocomplete="off"
          style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem"
        />
      </label>

      <label style="display:flex;flex-direction:column;gap:0.375rem;font-size:0.875rem;font-weight:500">
        Score threshold (0–100)
        <input
          type="number"
          bind:value={scoreThreshold}
          min="0"
          max="100"
          style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;width:120px"
        />
      </label>
    </div>
  </section>

  <!-- ── Search ──────────────────────────────────────────────────────────── -->
  <section style="margin-bottom:2rem">
    <h2 style="font-size:1rem;font-weight:600;margin:0 0 1rem;padding-bottom:0.5rem;border-bottom:1px solid #e5e7eb">
      Job Search
    </h2>

    <div style="display:grid;gap:1rem">
      <label style="display:flex;flex-direction:column;gap:0.375rem;font-size:0.875rem;font-weight:500">
        Search terms (comma-separated)
        <input
          type="text"
          bind:value={searchTerms}
          placeholder="e.g. Software Engineer, Backend Developer"
          style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem"
        />
      </label>

      <label style="display:flex;flex-direction:column;gap:0.375rem;font-size:0.875rem;font-weight:500">
        Location
        <input
          type="text"
          bind:value={searchLocation}
          placeholder="e.g. London"
          style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem"
        />
      </label>

      <label style="display:flex;flex-direction:column;gap:0.375rem;font-size:0.875rem;font-weight:500">
        Country
        <input
          type="text"
          bind:value={searchCountry}
          placeholder="e.g. uk"
          style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;width:120px"
        />
      </label>

      <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer">
        <input type="checkbox" bind:checked={searchRemote} />
        Remote only
      </label>

      <label style="display:flex;flex-direction:column;gap:0.375rem;font-size:0.875rem;font-weight:500">
        Results wanted per search term
        <input
          type="number"
          bind:value={resultsWanted}
          min="1"
          max="200"
          style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;width:120px"
        />
      </label>
    </div>
  </section>

  <!-- ── RxResume ────────────────────────────────────────────────────────── -->
  <section style="margin-bottom:2rem">
    <h2 style="font-size:1rem;font-weight:600;margin:0 0 1rem;padding-bottom:0.5rem;border-bottom:1px solid #e5e7eb">
      RxResume (PDF Generation)
    </h2>

    <div style="display:grid;gap:1rem">
      <label style="display:flex;flex-direction:column;gap:0.375rem;font-size:0.875rem;font-weight:500">
        RxResume URL
        <input
          type="url"
          bind:value={rxResumeUrl}
          placeholder="http://localhost:3100"
          style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem"
        />
      </label>

      <label style="display:flex;flex-direction:column;gap:0.375rem;font-size:0.875rem;font-weight:500">
        RxResume email
        <input
          type="email"
          bind:value={rxResumeEmail}
          placeholder="user@example.com"
          style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem"
        />
      </label>

      <label style="display:flex;flex-direction:column;gap:0.375rem;font-size:0.875rem;font-weight:500">
        RxResume password
        <input
          type="password"
          bind:value={rxResumePass}
          autocomplete="off"
          style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem"
        />
      </label>
    </div>
  </section>

  <!-- ── Save ───────────────────────────────────────────────────────────── -->
  <div style="display:flex;align-items:center;gap:1rem">
    <button
      onclick={save}
      disabled={saving}
      aria-label="Save settings"
      style="padding:0.6rem 1.5rem;background:{saving ? '#93c5fd' : '#2563eb'};color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:{saving ? 'not-allowed' : 'pointer'}"
    >
      {saving ? "Saving…" : "Save Settings"}
    </button>

    {#if saved}
      <span style="font-size:0.875rem;color:#15803d" role="status">Settings saved.</span>
    {/if}

    {#if saveErr}
      <span style="font-size:0.875rem;color:#991b1b" role="alert">{saveErr}</span>
    {/if}
  </div>
</div>
