<script lang="ts">
  import { goto } from "$app/navigation";
  import { trpc } from "$lib/trpc/client.js";

  // Steps: account → llm → rxresume → searchterms → done
  let step = $state<"account" | "llm" | "rxresume" | "searchterms" | "done">("account");

  // Account step
  let username = $state("");
  let password = $state("");
  let displayName = $state("");

  // LLM step
  let llmProvider = $state<"openai" | "openrouter" | "anthropic" | "google" | "lm_studio">("openrouter");
  let llmApiKey = $state("");
  let llmModel = $state("");
  let llmEndpoint = $state("");
  let llmValidated = $state(false);
  let llmValidating = $state(false);
  let llmError = $state<string | null>(null);

  // RxResume step
  let rxUrl = $state("");
  let rxEmail = $state("");
  let rxPassword = $state("");
  let rxValidated = $state(false);
  let rxValidating = $state(false);
  let rxError = $state<string | null>(null);
  let rxSkipped = $state(false);

  // Search terms step
  let searchTermsInput = $state("");
  let searchLocation = $state("");
  let searchCountry = $state("us");
  let searchRemote = $state(false);

  let error = $state<string | null>(null);
  let loading = $state(false);

  const LLM_PROVIDERS = [
    { id: "openrouter", label: "OpenRouter" },
    { id: "openai", label: "OpenAI" },
    { id: "anthropic", label: "Anthropic" },
    { id: "google", label: "Google Gemini" },
    { id: "lm_studio", label: "LM Studio (local)" },
  ] as const;

  async function submitAccount(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    loading = true;
    try {
      await trpc.auth.setup.mutate({ username, password, displayName: displayName || undefined });
      step = "llm";
    } catch (err) {
      error = err instanceof Error ? err.message : "Setup failed";
    } finally {
      loading = false;
    }
  }

  async function validateLlm() {
    llmError = null;
    llmValidating = true;
    try {
      const result = await trpc.settings.validateLlm.mutate({
        provider: llmProvider,
        apiKey: llmApiKey || undefined,
        endpoint: llmEndpoint || undefined,
        model: llmModel || undefined,
      });
      if (result.ok) {
        llmValidated = true;
      } else {
        llmError = result.error ?? "Validation failed";
      }
    } catch (err) {
      llmError = err instanceof Error ? err.message : "Validation failed";
    } finally {
      llmValidating = false;
    }
  }

  async function saveLlm() {
    loading = true;
    try {
      await trpc.settings.update.mutate({
        llmProvider,
        llmApiKey,
        llmModel: llmModel || undefined,
        llmEndpoint: llmEndpoint || undefined,
      });
      step = "rxresume";
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save";
    } finally {
      loading = false;
    }
  }

  async function validateRxResume() {
    rxError = null;
    rxValidating = true;
    try {
      const result = await trpc.settings.validateRxResume.mutate({
        url: rxUrl, email: rxEmail, password: rxPassword,
      });
      if (result.ok) {
        rxValidated = true;
      } else {
        rxError = result.error ?? "Connection failed";
      }
    } catch (err) {
      rxError = err instanceof Error ? err.message : "Connection failed";
    } finally {
      rxValidating = false;
    }
  }

  async function saveRxResume() {
    loading = true;
    try {
      await trpc.settings.update.mutate({
        rxresumeUrl: rxUrl,
        rxresumeEmail: rxEmail,
        rxresumePassword: rxPassword,
      });
      step = "searchterms";
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save";
    } finally {
      loading = false;
    }
  }

  async function saveSearchTerms() {
    loading = true;
    try {
      const terms = searchTermsInput.split(",").map((t) => t.trim()).filter(Boolean);
      await trpc.settings.update.mutate({
        searchTerms: terms,
        searchLocation: searchLocation || undefined,
        searchCountry: searchCountry || undefined,
        searchRemote,
      });
      step = "done";
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save";
    } finally {
      loading = false;
    }
  }

  const STEPS = ["account", "llm", "rxresume", "searchterms", "done"] as const;
  const STEP_LABELS = { account: "Account", llm: "AI Model", rxresume: "Resume", searchterms: "Search", done: "Done" };
</script>

<svelte:head><title>Setup — Job-Ops</title></svelte:head>

<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f9fafb;font-family:sans-serif;padding:1rem">
  <div style="width:100%;max-width:480px">

    <!-- Progress rail -->
    <div style="display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:2rem">
      {#each STEPS as s, i}
        {@const active = s === step}
        {@const done = STEPS.indexOf(step) > i}
        <div style="display:flex;align-items:center">
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
            <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;background:{done ? '#10b981' : active ? '#0070f3' : '#e5e7eb'};color:{done || active ? '#fff' : '#9ca3af'}">
              {done ? "✓" : i + 1}
            </div>
            <span style="font-size:0.65rem;color:{active ? '#0070f3' : '#9ca3af'};white-space:nowrap">{STEP_LABELS[s]}</span>
          </div>
          {#if i < STEPS.length - 1}
            <div style="width:50px;height:2px;background:{done ? '#10b981' : '#e5e7eb'};margin:0 4px;margin-bottom:16px"></div>
          {/if}
        </div>
      {/each}
    </div>

    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:2rem">

      <!-- Step 1: Account -->
      {#if step === "account"}
        <h1 style="font-size:1.3rem;font-weight:700;margin:0 0 0.25rem">Create Admin Account</h1>
        <p style="color:#6b7280;font-size:0.875rem;margin:0 0 1.5rem">This will be the primary administrator account.</p>
        {#if error}
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:0.6rem 0.8rem;border-radius:6px;font-size:0.875rem;margin-bottom:1rem">{error}</div>
        {/if}
        <form onsubmit={submitAccount}>
          <label style="display:block;margin-bottom:1rem">
            <span style="font-size:0.875rem;font-weight:500;color:#374151">Username</span>
            <input type="text" bind:value={username} autocomplete="username" required placeholder="e.g. admin"
              style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box" />
          </label>
          <label style="display:block;margin-bottom:1rem">
            <span style="font-size:0.875rem;font-weight:500;color:#374151">Display name <span style="font-weight:400;color:#9ca3af">(optional)</span></span>
            <input type="text" bind:value={displayName} autocomplete="name" placeholder="e.g. Rob"
              style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box" />
          </label>
          <label style="display:block;margin-bottom:1.5rem">
            <span style="font-size:0.875rem;font-weight:500;color:#374151">Password <span style="font-weight:400;color:#9ca3af">(min 8 chars)</span></span>
            <input type="password" bind:value={password} autocomplete="new-password" required minlength="8"
              style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box" />
          </label>
          <button type="submit" disabled={loading}
            style="width:100%;padding:0.6rem;background:#0070f3;color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:{loading ? 'wait' : 'pointer'};opacity:{loading ? 0.7 : 1}">
            {loading ? "Creating…" : "Create Account & Continue"}
          </button>
        </form>

      <!-- Step 2: LLM -->
      {:else if step === "llm"}
        <h1 style="font-size:1.3rem;font-weight:700;margin:0 0 0.25rem">Configure AI Model</h1>
        <p style="color:#6b7280;font-size:0.875rem;margin:0 0 1.5rem">Used for job scoring, ghostwriter, and resume tailoring.</p>
        {#if error}<div style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:0.6rem 0.8rem;border-radius:6px;font-size:0.875rem;margin-bottom:1rem">{error}</div>{/if}

        <label style="display:block;margin-bottom:1rem">
          <span style="font-size:0.875rem;font-weight:500;color:#374151">Provider</span>
          <select bind:value={llmProvider} onchange={() => { llmValidated = false; llmError = null; }}
            style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box">
            {#each LLM_PROVIDERS as p}<option value={p.id}>{p.label}</option>{/each}
          </select>
        </label>

        {#if llmProvider !== "lm_studio"}
          <label style="display:block;margin-bottom:1rem">
            <span style="font-size:0.875rem;font-weight:500;color:#374151">API Key</span>
            <input type="password" bind:value={llmApiKey} placeholder="sk-…"
              oninput={() => { llmValidated = false; llmError = null; }}
              style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box" />
          </label>
        {/if}

        {#if llmProvider === "openai" || llmProvider === "lm_studio"}
          <label style="display:block;margin-bottom:1rem">
            <span style="font-size:0.875rem;font-weight:500;color:#374151">
              {llmProvider === "lm_studio" ? "LM Studio URL" : "API Endpoint (optional)"}
            </span>
            <input type="url" bind:value={llmEndpoint} placeholder={llmProvider === "lm_studio" ? "http://localhost:1234/v1" : "https://api.openai.com/v1"}
              style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box" />
          </label>
        {/if}

        <label style="display:block;margin-bottom:1.5rem">
          <span style="font-size:0.875rem;font-weight:500;color:#374151">Model <span style="font-weight:400;color:#9ca3af">(optional — uses provider default)</span></span>
          <input type="text" bind:value={llmModel} placeholder={llmProvider === "anthropic" ? "claude-sonnet-4-6" : llmProvider === "openai" ? "gpt-4o-mini" : ""}
            style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box" />
        </label>

        {#if llmError}
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:0.5rem 0.75rem;border-radius:6px;font-size:0.8rem;margin-bottom:1rem">{llmError}</div>
        {:else if llmValidated}
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:0.5rem 0.75rem;border-radius:6px;font-size:0.8rem;margin-bottom:1rem">✓ Connection verified</div>
        {/if}

        <div style="display:flex;gap:0.5rem">
          <button onclick={validateLlm} disabled={llmValidating}
            style="flex:1;padding:0.55rem;border:1px solid #d1d5db;background:#fff;border-radius:6px;font-size:0.875rem;cursor:{llmValidating ? 'wait' : 'pointer'}">
            {llmValidating ? "Checking…" : "Test Connection"}
          </button>
          <button onclick={saveLlm} disabled={loading}
            style="flex:2;padding:0.55rem;background:#0070f3;color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:{loading ? 'wait' : 'pointer'};opacity:{loading ? 0.7 : 1}">
            {loading ? "Saving…" : "Save & Continue"}
          </button>
        </div>
        <button onclick={() => { step = "rxresume"; }}
          style="width:100%;margin-top:0.5rem;padding:0.45rem;border:none;background:none;color:#9ca3af;font-size:0.8rem;cursor:pointer">
          Skip for now
        </button>

      <!-- Step 3: RxResume -->
      {:else if step === "rxresume"}
        <h1 style="font-size:1.3rem;font-weight:700;margin:0 0 0.25rem">Connect Reactive Resume</h1>
        <p style="color:#6b7280;font-size:0.875rem;margin:0 0 1.5rem">Optional — used for PDF generation and resume studio. Skip if you don't use RxResume.</p>
        {#if error}<div style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:0.6rem 0.8rem;border-radius:6px;font-size:0.875rem;margin-bottom:1rem">{error}</div>{/if}

        <label style="display:block;margin-bottom:1rem">
          <span style="font-size:0.875rem;font-weight:500;color:#374151">RxResume URL</span>
          <input type="url" bind:value={rxUrl} placeholder="https://rxresume.yourhost.com"
            oninput={() => { rxValidated = false; rxError = null; }}
            style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box" />
        </label>
        <label style="display:block;margin-bottom:1rem">
          <span style="font-size:0.875rem;font-weight:500;color:#374151">Email</span>
          <input type="email" bind:value={rxEmail} oninput={() => { rxValidated = false; rxError = null; }}
            style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box" />
        </label>
        <label style="display:block;margin-bottom:1.5rem">
          <span style="font-size:0.875rem;font-weight:500;color:#374151">Password</span>
          <input type="password" bind:value={rxPassword} oninput={() => { rxValidated = false; rxError = null; }}
            style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box" />
        </label>

        {#if rxError}
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:0.5rem 0.75rem;border-radius:6px;font-size:0.8rem;margin-bottom:1rem">{rxError}</div>
        {:else if rxValidated}
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:0.5rem 0.75rem;border-radius:6px;font-size:0.8rem;margin-bottom:1rem">✓ Connected</div>
        {/if}

        <div style="display:flex;gap:0.5rem">
          <button onclick={validateRxResume} disabled={rxValidating || !rxUrl || !rxEmail || !rxPassword}
            style="flex:1;padding:0.55rem;border:1px solid #d1d5db;background:#fff;border-radius:6px;font-size:0.875rem;cursor:{rxValidating ? 'wait' : 'pointer'}">
            {rxValidating ? "Checking…" : "Test"}
          </button>
          <button onclick={saveRxResume} disabled={loading || (!rxUrl && !rxSkipped)}
            style="flex:2;padding:0.55rem;background:#0070f3;color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:{loading ? 'wait' : 'pointer'};opacity:{loading ? 0.7 : 1}">
            {loading ? "Saving…" : "Save & Continue"}
          </button>
        </div>
        <button onclick={() => { rxSkipped = true; step = "searchterms"; }}
          style="width:100%;margin-top:0.5rem;padding:0.45rem;border:none;background:none;color:#9ca3af;font-size:0.8rem;cursor:pointer">
          Skip for now
        </button>

      <!-- Step 4: Search Terms -->
      {:else if step === "searchterms"}
        <h1 style="font-size:1.3rem;font-weight:700;margin:0 0 0.25rem">Job Search Preferences</h1>
        <p style="color:#6b7280;font-size:0.875rem;margin:0 0 1.5rem">Set defaults for pipeline runs. You can change these per-run on the jobs page.</p>
        {#if error}<div style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:0.6rem 0.8rem;border-radius:6px;font-size:0.875rem;margin-bottom:1rem">{error}</div>{/if}

        <label style="display:block;margin-bottom:1rem">
          <span style="font-size:0.875rem;font-weight:500;color:#374151">Job titles / keywords <span style="font-weight:400;color:#9ca3af">(comma-separated)</span></span>
          <input type="text" bind:value={searchTermsInput} placeholder="e.g. Software Engineer, Backend Developer, SWE"
            style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box" />
        </label>

        <label style="display:block;margin-bottom:1rem">
          <span style="font-size:0.875rem;font-weight:500;color:#374151">Location <span style="font-weight:400;color:#9ca3af">(optional)</span></span>
          <input type="text" bind:value={searchLocation} placeholder="e.g. New York, NY"
            style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box" />
        </label>

        <label style="display:block;margin-bottom:1rem">
          <span style="font-size:0.875rem;font-weight:500;color:#374151">Country code <span style="font-weight:400;color:#9ca3af">(JobSpy param)</span></span>
          <select bind:value={searchCountry}
            style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box">
            <option value="us">US</option>
            <option value="uk">UK</option>
            <option value="ca">Canada</option>
            <option value="au">Australia</option>
            <option value="de">Germany</option>
            <option value="fr">France</option>
            <option value="in">India</option>
          </select>
        </label>

        <label style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1.5rem;cursor:pointer">
          <input type="checkbox" bind:checked={searchRemote}
            style="width:16px;height:16px;cursor:pointer" />
          <span style="font-size:0.875rem;font-weight:500;color:#374151">Remote only</span>
        </label>

        <div style="display:flex;gap:0.5rem">
          <button onclick={saveSearchTerms} disabled={loading}
            style="flex:1;padding:0.55rem;background:#0070f3;color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:{loading ? 'wait' : 'pointer'};opacity:{loading ? 0.7 : 1}">
            {loading ? "Saving…" : "Save & Continue"}
          </button>
        </div>
        <button onclick={() => { step = "done"; }}
          style="width:100%;margin-top:0.5rem;padding:0.45rem;border:none;background:none;color:#9ca3af;font-size:0.8rem;cursor:pointer">
          Skip for now
        </button>

      <!-- Step 5: Done -->
      {:else if step === "done"}
        <div style="text-align:center;padding:1rem 0">
          <div style="font-size:2.5rem;margin-bottom:1rem">🎉</div>
          <h1 style="font-size:1.3rem;font-weight:700;margin:0 0 0.5rem">You're all set!</h1>
          <p style="color:#6b7280;font-size:0.875rem;margin:0 0 1.5rem">Job-Ops is ready. Head to the jobs board to run your first pipeline.</p>
          <button onclick={() => goto("/jobs")}
            style="padding:0.65rem 2rem;background:#0070f3;color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:pointer">
            Go to Jobs
          </button>
        </div>
      {/if}

    </div>
  </div>
</div>
