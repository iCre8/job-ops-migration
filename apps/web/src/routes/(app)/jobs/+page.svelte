<script lang="ts">
  import JobCard from "$lib/components/JobCard.svelte";
  import { trpc } from "$lib/trpc/client.js";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  const STATUS_OPTIONS = [
    { value: "all", label: "All" },
    { value: "ready", label: "Ready" },
    { value: "applied", label: "Applied" },
    { value: "discovered", label: "Discovered" },
    { value: "in_progress", label: "In Progress" },
    { value: "skipped", label: "Skipped" },
    { value: "expired", label: "Expired" },
  ];

  const SITE_OPTIONS = ["linkedin", "indeed", "glassdoor"];

  let jobs = $state(data.jobs);
  let total = $state(data.total);
  let status = $state(data.status);
  let loading = $state(false);

  const recentRuns = data.recentRuns;

  // ── Pipeline config ────────────────────────────────────────────────────────
  let showConfig = $state(false);
  let cfgSites = $state<string[]>(["linkedin", "indeed", "glassdoor"]);
  let cfgTopN = $state(10);
  let cfgMinScore = $state(60);
  let cfgLocation = $state("");
  let cfgCountry = $state("us");
  let cfgRemote = $state(false);

  // ── Pipeline state ────────────────────────────────────────────────────────
  let pipelineRunning = $state(!!data.activeRun);
  let pipelineRunId = $state(data.activeRun?.id ?? "");
  let pipelineLog: string[] = $state(
    data.activeRun ? [`[reconnected] Pipeline run ${data.activeRun.id.slice(-6)} in progress…`] : [],
  );
  let pipelineError = $state("");
  let cancelling = $state(false);

  // Reconnect SSE if a run was already active when the page loaded
  if (data.activeRun) {
    connectSse(data.activeRun.id);
  }

  async function refetch() {
    loading = true;
    try {
      const result = await trpc.jobs.list.query({ status, page: 1, pageSize: 50 });
      jobs = result.jobs;
      total = result.total;
    } finally {
      loading = false;
    }
  }

  function onStatusChange(e: Event) {
    status = (e.target as HTMLSelectElement).value;
    refetch();
  }

  function toggleSite(site: string) {
    if (cfgSites.includes(site)) {
      cfgSites = cfgSites.filter((s) => s !== site);
    } else {
      cfgSites = [...cfgSites, site];
    }
  }

  function connectSse(runId: string) {
    const es = new EventSource(`/api/pipeline/stream?runId=${runId}`);

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as { type: string; message: string };
        pipelineLog = [...pipelineLog, `[${new Date().toLocaleTimeString()}] ${evt.message}`];
        if (evt.type === "complete") {
          pipelineRunning = false;
          cancelling = false;
          es.close();
          refetch();
        } else if (evt.type === "error") {
          pipelineError = evt.message;
          pipelineRunning = false;
          cancelling = false;
          es.close();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      if (pipelineRunning) {
        pipelineRunning = false;
        cancelling = false;
        pipelineLog = [...pipelineLog, `[${new Date().toLocaleTimeString()}] Stream closed`];
      }
      es.close();
    };
  }

  async function runPipeline() {
    pipelineRunning = true;
    pipelineRunId = "";
    pipelineLog = [];
    pipelineError = "";
    cancelling = false;
    showConfig = false;

    let runId: string;
    try {
      const result = await trpc.pipeline.trigger.mutate({
        triggeredBy: "manual",
        sites: cfgSites,
        topN: cfgTopN,
        minSuitabilityScore: cfgMinScore,
        location: cfgLocation || undefined,
        country: cfgCountry || undefined,
        isRemote: cfgRemote,
      });
      runId = result.id;
      pipelineRunId = runId;
    } catch (err) {
      pipelineError = err instanceof Error ? err.message : "Failed to start pipeline";
      pipelineRunning = false;
      return;
    }

    pipelineLog = [`[${new Date().toLocaleTimeString()}] Pipeline started (run ${runId.slice(-6)})`];
    connectSse(runId);
  }

  async function cancelPipeline() {
    if (!pipelineRunId || cancelling) return;
    cancelling = true;
    try {
      await trpc.pipeline.cancel.mutate({ id: pipelineRunId });
      pipelineLog = [...pipelineLog, `[${new Date().toLocaleTimeString()}] Cancellation requested…`];
    } catch (err) {
      pipelineLog = [...pipelineLog, `[${new Date().toLocaleTimeString()}] Cancel failed: ${err instanceof Error ? err.message : "unknown"}`];
      cancelling = false;
    }
  }

  // ── Manual import ─────────────────────────────────────────────────────────
  let showImport = $state(false);
  let importTab = $state<"url" | "text" | "manual">("url");
  let importUrl = $state("");
  let importText = $state("");
  let importParsing = $state(false);
  let importSaving = $state(false);
  let importError = $state("");
  let importForm = $state({
    title: "", employer: "", location: "", jobDescription: "",
    url: "", salaryMin: "", salaryMax: "", salaryCurrency: "",
    jobType: "", isRemote: false,
  });

  function resetImport() {
    importUrl = ""; importText = ""; importParsing = false;
    importSaving = false; importError = "";
    importForm = { title: "", employer: "", location: "", jobDescription: "",
      url: "", salaryMin: "", salaryMax: "", salaryCurrency: "", jobType: "", isRemote: false };
  }

  async function parseFromUrl() {
    if (!importUrl.trim()) return;
    importParsing = true; importError = "";
    try {
      const result = await trpc.manualJobs.fetchFromUrl.mutate({ url: importUrl.trim() });
      importForm = {
        title: result.title ?? "",
        employer: result.employer ?? "",
        location: result.location ?? "",
        jobDescription: result.jobDescription ?? "",
        url: importUrl.trim(),
        salaryMin: result.salaryMin?.toString() ?? "",
        salaryMax: result.salaryMax?.toString() ?? "",
        salaryCurrency: result.salaryCurrency ?? "",
        jobType: result.jobType ?? "",
        isRemote: result.isRemote ?? false,
      };
      importTab = "manual";
    } catch (err) {
      importError = err instanceof Error ? err.message : "Failed to fetch from URL";
    } finally {
      importParsing = false;
    }
  }

  async function parseFromText() {
    if (!importText.trim()) return;
    importParsing = true; importError = "";
    try {
      const result = await trpc.manualJobs.parseFromText.mutate({ text: importText.trim() });
      importForm = {
        ...importForm,
        title: result.title ?? "",
        employer: result.employer ?? "",
        location: result.location ?? "",
        jobDescription: result.jobDescription ?? "",
      };
      importTab = "manual";
    } catch (err) {
      importError = err instanceof Error ? err.message : "Failed to parse text";
    } finally {
      importParsing = false;
    }
  }

  async function submitImport() {
    if (!importForm.title.trim()) { importError = "Title is required"; return; }
    importSaving = true; importError = "";
    try {
      await trpc.manualJobs.import.mutate({
        title: importForm.title.trim(),
        employer: importForm.employer.trim() || undefined,
        location: importForm.location.trim() || undefined,
        jobDescription: importForm.jobDescription.trim() || undefined,
        url: importForm.url.trim() || undefined,
        salaryMin: importForm.salaryMin ? Number(importForm.salaryMin) : undefined,
        salaryMax: importForm.salaryMax ? Number(importForm.salaryMax) : undefined,
        salaryCurrency: importForm.salaryCurrency.trim() || undefined,
        jobType: importForm.jobType.trim() || undefined,
        isRemote: importForm.isRemote,
      });
      showImport = false;
      resetImport();
      refetch();
    } catch (err) {
      importError = err instanceof Error ? err.message : "Failed to import job";
    } finally {
      importSaving = false;
    }
  }
</script>

<svelte:head>
  <title>Jobs — Job-Ops</title>
</svelte:head>

<div class="jobs-page-container fade-in">
  <!-- Header row -->
  <header class="jobs-header">
    <div>
      <h1 class="page-title">Jobs</h1>
      <p class="page-subtitle">
        {total} {total === 1 ? "job" : "jobs"}
        {#if status !== "all"}with status <strong class="highlight-status">{status}</strong>{/if}
      </p>
    </div>
    <div class="controls-bar">
      <select
        aria-label="Filter by status"
        value={status}
        onchange={onStatusChange}
        class="select status-select"
      >
        {#each STATUS_OPTIONS as opt (opt.value)}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>

      <button
        onclick={() => { showImport = true; resetImport(); }}
        aria-label="Import job"
        class="btn btn-secondary btn-sm"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Import
      </button>

      {#if !pipelineRunning}
        <button
          onclick={() => { showConfig = !showConfig; }}
          aria-label="Pipeline settings"
          title="Configure pipeline"
          class="btn btn-secondary btn-sm settings-toggle-btn"
          class:active={showConfig}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      {/if}

      {#if pipelineRunning}
        <button
          onclick={cancelPipeline}
          disabled={cancelling}
          aria-label="Cancel pipeline"
          class="btn btn-danger btn-sm"
        >
          {cancelling ? "Cancelling…" : "Cancel"}
        </button>
      {/if}

      <button
        onclick={runPipeline}
        disabled={pipelineRunning}
        aria-label="Run pipeline"
        class="btn btn-primary btn-sm run-btn"
      >
        {#if pipelineRunning}
          <span class="btn-spinner"></span>
          Running…
        {:else}
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Run Pipeline
        {/if}
      </button>
    </div>
  </header>

  <!-- Pipeline config panel -->
  {#if showConfig && !pipelineRunning}
    <div class="card config-panel fade-in">
      <p class="config-title">Pipeline Configuration</p>
      <div class="config-grid">
        <!-- Sources -->
        <div class="form-group full-width">
          <label class="form-label">Job Boards</label>
          <div class="board-toggles">
            {#each SITE_OPTIONS as site (site)}
              <button
                onclick={() => toggleSite(site)}
                class="board-pill-btn"
                class:active={cfgSites.includes(site)}
              >
                {site}
              </button>
            {/each}
          </div>
        </div>

        <!-- Top N -->
        <div class="form-group">
          <label class="form-label">
            Top N jobs to process: <strong class="config-val">{cfgTopN}</strong>
          </label>
          <input type="range" min="1" max="50" bind:value={cfgTopN} class="range-slider" />
        </div>

        <!-- Min Score -->
        <div class="form-group">
          <label class="form-label">
            Min suitability score: <strong class="config-val">{cfgMinScore}</strong>
          </label>
          <input type="range" min="0" max="100" bind:value={cfgMinScore} class="range-slider" />
        </div>

        <!-- Location -->
        <div class="form-group">
          <label class="form-label">Location</label>
          <input type="text" bind:value={cfgLocation} placeholder="City, State" class="input" />
        </div>

        <!-- Country -->
        <div class="form-group">
          <label class="form-label">Country code</label>
          <input type="text" bind:value={cfgCountry} placeholder="us" class="input" />
        </div>

        <!-- Remote -->
        <div class="form-group checkbox-group">
          <input type="checkbox" id="cfg-remote" bind:checked={cfgRemote} class="checkbox" />
          <label for="cfg-remote" class="checkbox-label">Remote only</label>
        </div>
      </div>
    </div>
  {/if}

  <!-- Pipeline progress log -->
  {#if pipelineLog.length > 0}
    <div class="log-container fade-in">
      <div class="log-header">
        <span class="log-dot"></span>
        Scraper Log output
      </div>
      <div class="terminal-box log-box" aria-label="Pipeline log">
        {#each pipelineLog as line (line)}
          <div class="log-line">{line}</div>
        {/each}
      </div>
    </div>
  {/if}

  {#if pipelineError}
    <div class="alert-danger fade-in" role="alert">
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {pipelineError}
    </div>
  {/if}

  <!-- Recent pipeline runs -->
  {#if recentRuns.length > 0 && !pipelineRunning}
    <details class="recent-runs-details">
      <summary class="recent-runs-summary">
        Recent runs ({recentRuns.length})
        <svg class="details-chevron" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"/></svg>
      </summary>
      <div class="recent-runs-list">
        {#each recentRuns as run (run.id)}
          {@const statusColorClass = run.status === 'completed' ? 'text-success' : run.status === 'failed' ? 'text-danger' : run.status === 'cancelled' ? 'text-warning' : 'text-info'}
          <div class="recent-run-row">
            <div class="run-meta">
              <span class="run-status {statusColorClass}">{run.status}</span>
              <span class="run-time">{new Date(run.startedAt).toLocaleString()}</span>
            </div>
            <div class="run-stats">
              {#if run.jobsFound > 0}<span class="stat-tag">{run.jobsFound} found</span>{/if}
              {#if run.jobsScored > 0}<span class="stat-tag">{run.jobsScored} scored</span>{/if}
              {#if run.error}<span class="run-error" title={run.error}>{run.error}</span>{/if}
            </div>
          </div>
        {/each}
      </div>
    </details>
  {/if}

  <!-- Jobs list -->
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading jobs list...</p>
    </div>
  {:else if jobs.length === 0}
    <div class="empty-state">
      <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
      <p>No jobs found</p>
      <span class="empty-hint">Run the pipeline to discover new jobs, or change the status filter.</span>
    </div>
  {:else}
    <div class="jobs-list">
      {#each jobs as job (job.id)}
        <JobCard {job} onaction={refetch} />
      {/each}
    </div>
  {/if}
</div>

<!-- Import Job modal -->
{#if showImport}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    onclick={(e) => { if (e.target === e.currentTarget) showImport = false; }}
    class="modal-backdrop"
  >
    <div class="modal-card fade-in">
      <!-- Modal header -->
      <header class="modal-header">
        <h2 class="modal-title">Import Job</h2>
        <button onclick={() => { showImport = false; }} class="modal-close-btn">&times;</button>
      </header>

      <!-- Tab bar -->
      <nav class="modal-tabs">
        {#each ([["url","From URL"],["text","Paste Text"],["manual","Manual"]] as const) as [t, label] (t)}
          <button
            onclick={() => { importTab = t; }}
            class="modal-tab-btn"
            class:active={importTab === t}
          >{label}</button>
        {/each}
      </nav>

      <div class="modal-body">
        {#if importError}
          <div class="modal-alert-danger">{importError}</div>
        {/if}

        <!-- From URL -->
        {#if importTab === "url"}
          <div class="form-group">
            <label class="form-label">Job posting URL</label>
            <input
              type="url"
              bind:value={importUrl}
              placeholder="https://linkedin.com/jobs/view/..."
              class="input"
            />
            <button
              onclick={parseFromUrl}
              disabled={!importUrl.trim() || importParsing}
              class="btn btn-primary btn-sm import-action-btn"
            >
              {#if importParsing}
                <span class="btn-spinner"></span>
                Fetching…
              {:else}
                Fetch & Parse
              {/if}
            </button>
            <p class="import-help-text">Requires the Python extractor sidecar service to be running.</p>
          </div>

        <!-- Paste text -->
        {:else if importTab === "text"}
          <div class="form-group">
            <label class="form-label">Paste job description</label>
            <textarea
              bind:value={importText}
              rows="8"
              placeholder="Paste the full text of the job description here..."
              class="textarea"
            ></textarea>
            <button
              onclick={parseFromText}
              disabled={importText.trim().length < 50 || importParsing}
              class="btn btn-primary btn-sm import-action-btn"
            >
              {#if importParsing}
                <span class="btn-spinner"></span>
                Parsing…
              {:else}
                Parse Text
              {/if}
            </button>
          </div>

        <!-- Manual form -->
        {:else}
          <div class="manual-form-grid">
            <div class="form-group">
              <label class="form-label">Title <span class="required">*</span></label>
              <input type="text" bind:value={importForm.title} placeholder="Software Engineer" class="input" />
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Employer</label>
                <input type="text" bind:value={importForm.employer} placeholder="Acme Corp" class="input" />
              </div>
              <div class="form-group">
                <label class="form-label">Location</label>
                <input type="text" bind:value={importForm.location} placeholder="Remote / New York" class="input" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Job posting URL</label>
              <input type="url" bind:value={importForm.url} placeholder="https://…" class="input" />
            </div>
            <div class="form-group">
              <label class="form-label">Job description</label>
              <textarea bind:value={importForm.jobDescription} rows="5" placeholder="Paste or type the job description…" class="textarea"></textarea>
            </div>
            <div class="form-row-3">
              <div class="form-group">
                <label class="form-label">Min salary</label>
                <input type="number" bind:value={importForm.salaryMin} placeholder="60000" class="input" />
              </div>
              <div class="form-group">
                <label class="form-label">Max salary</label>
                <input type="number" bind:value={importForm.salaryMax} placeholder="90000" class="input" />
              </div>
              <div class="form-group">
                <label class="form-label">Currency</label>
                <input type="text" bind:value={importForm.salaryCurrency} placeholder="USD" class="input" />
              </div>
            </div>
            <div class="form-group checkbox-group">
              <input type="checkbox" id="imp-remote" bind:checked={importForm.isRemote} class="checkbox" />
              <label for="imp-remote" class="checkbox-label">Remote Position</label>
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      {#if importTab === "manual"}
        <footer class="modal-footer">
          <button onclick={() => { showImport = false; }} class="btn btn-secondary">
            Cancel
          </button>
          <button
            onclick={submitImport}
            disabled={!importForm.title.trim() || importSaving}
            class="btn btn-primary"
          >
            {#if importSaving}
              <span class="btn-spinner"></span>
              Importing…
            {:else}
              Import Job
            {/if}
          </button>
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  .jobs-page-container {
    padding: 2rem;
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .jobs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 1.25rem;
  }

  .page-title {
    font-size: 1.75rem;
    font-weight: 700;
  }

  .page-subtitle {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .highlight-status {
    color: var(--accent-text);
  }

  .controls-bar {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex-wrap: wrap;
  }

  .status-select {
    width: auto;
    padding-top: 0.4rem;
    padding-bottom: 0.4rem;
    font-size: 0.85rem;
  }

  .settings-toggle-btn.active {
    background-color: var(--accent-bg);
    border-color: var(--accent-color);
    color: var(--accent-text);
  }

  .run-btn {
    min-width: 130px;
  }

  .btn-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* Configuration Panel */
  .config-panel {
    background-color: var(--bg-sidebar);
    border-color: var(--border-color);
  }

  .config-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.25rem;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  .board-toggles {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .board-pill-btn {
    border: 1px solid var(--border-color);
    background-color: var(--bg-app);
    color: var(--text-secondary);
    padding: 0.35rem 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 99px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .board-pill-btn:hover {
    color: var(--text-primary);
    border-color: var(--border-hover);
  }

  .board-pill-btn.active {
    background-color: var(--accent-bg);
    border-color: var(--accent-color);
    color: var(--accent-text);
  }

  .config-val {
    color: var(--accent-text);
  }

  .range-slider {
    width: 100%;
    accent-color: var(--accent-color);
    background-color: var(--border-color);
    height: 4px;
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .checkbox-group {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .checkbox {
    accent-color: var(--accent-color);
    cursor: pointer;
  }

  .checkbox-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    cursor: pointer;
    user-select: none;
  }

  /* Log Panel */
  .log-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .log-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .log-dot {
    width: 6px;
    height: 6px;
    background-color: var(--success-color);
    border-radius: 50%;
    box-shadow: 0 0 6px var(--success-color);
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0% { opacity: 0.4; }
    50% { opacity: 1; }
    100% { opacity: 0.4; }
  }

  .log-box {
    max-height: 150px;
    background-color: #060608;
  }

  .log-line {
    padding: 0.1rem 0;
  }

  .alert-danger {
    background-color: var(--danger-bg);
    border: 1px solid var(--danger-border);
    color: var(--danger-text);
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  /* Recent Runs Details */
  .recent-runs-details {
    border: 1px solid var(--border-color);
    background-color: var(--bg-card);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .recent-runs-summary {
    padding: 0.65rem 1rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: background-color var(--transition-fast);
  }

  .recent-runs-summary:hover {
    background-color: var(--bg-card-hover);
    color: var(--text-primary);
  }

  .recent-runs-details[open] .details-chevron {
    transform: rotate(180deg);
  }

  .details-chevron {
    transition: transform var(--transition-fast);
    opacity: 0.7;
  }

  .recent-runs-list {
    border-top: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    background-color: rgba(0,0,0,0.15);
  }

  .recent-run-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--border-color);
    font-size: 0.8rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .recent-run-row:last-child {
    border-bottom: none;
  }

  .run-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .run-status {
    font-weight: 600;
    text-transform: capitalize;
  }

  .text-success { color: var(--success-text); }
  .text-danger { color: var(--danger-text); }
  .text-warning { color: var(--warning-text); }
  .text-info { color: var(--info-text); }

  .run-time {
    color: var(--text-muted);
  }

  .run-stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stat-tag {
    background-color: var(--bg-sidebar);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .run-error {
    color: var(--danger-text);
    font-size: 0.75rem;
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* List & States */
  .jobs-list {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 4rem 2rem;
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-lg);
    color: var(--text-muted);
    background-color: var(--bg-card);
  }

  .empty-hint {
    font-size: 0.85rem;
    color: var(--text-muted);
    max-width: 320px;
    text-align: center;
  }

  /* Modal Styles */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .modal-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 600px;
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .modal-close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-muted);
    line-height: 1;
    transition: color var(--transition-fast);
  }

  .modal-close-btn:hover {
    color: var(--text-primary);
  }

  .modal-tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color);
    padding: 0 1.5rem;
    background-color: rgba(0,0,0,0.1);
  }

  .modal-tab-btn {
    padding: 0.85rem 1.25rem;
    border: none;
    background: none;
    font-family: var(--font-sans);
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .modal-tab-btn:hover {
    color: var(--text-primary);
  }

  .modal-tab-btn.active {
    color: var(--accent-text);
    border-bottom-color: var(--accent-color);
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .modal-alert-danger {
    background-color: var(--danger-bg);
    border: 1px solid var(--danger-border);
    color: var(--danger-text);
    padding: 0.6rem 0.85rem;
    border-radius: var(--radius-md);
    font-size: 0.8rem;
  }

  .import-action-btn {
    align-self: flex-start;
    margin-top: 0.5rem;
  }

  .import-help-text {
    font-size: 0.725rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }

  .manual-form-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-row-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.75rem;
  }

  .required {
    color: var(--danger-color);
  }

  .modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 0.65rem;
    background-color: rgba(0,0,0,0.1);
  }
</style>
