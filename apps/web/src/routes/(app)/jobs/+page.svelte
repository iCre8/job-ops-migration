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

<div style="padding:2rem;max-width:900px;margin:0 auto">
  <!-- Header row -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
    <div>
      <h1 style="font-size:1.5rem;font-weight:700;margin:0">Jobs</h1>
      <p style="color:#6b7280;font-size:0.875rem;margin-top:0.25rem">
        {total} {total === 1 ? "job" : "jobs"}
        {#if status !== "all"}with status <strong>{status}</strong>{/if}
      </p>
    </div>
    <div style="display:flex;align-items:center;gap:0.75rem">
      <select
        aria-label="Filter by status"
        value={status}
        onchange={onStatusChange}
        style="padding:0.4rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;background:#fff"
      >
        {#each STATUS_OPTIONS as opt (opt.value)}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>

      <button
        onclick={() => { showImport = true; resetImport(); }}
        aria-label="Import job"
        style="padding:0.4rem 0.85rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;background:#fff;cursor:pointer;color:#374151"
      >+ Import</button>

      {#if !pipelineRunning}
        <button
          onclick={() => { showConfig = !showConfig; }}
          aria-label="Pipeline settings"
          title="Configure pipeline"
          style="padding:0.4rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;background:#fff;cursor:pointer;color:#374151"
        >⚙</button>
      {/if}

      {#if pipelineRunning}
        <button
          onclick={cancelPipeline}
          disabled={cancelling}
          aria-label="Cancel pipeline"
          style="padding:0.4rem 1rem;background:{cancelling ? '#fca5a5' : '#dc2626'};color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:{cancelling ? 'not-allowed' : 'pointer'}"
        >
          {cancelling ? "Cancelling…" : "Cancel"}
        </button>
      {/if}

      <button
        onclick={runPipeline}
        disabled={pipelineRunning}
        aria-label="Run pipeline"
        style="padding:0.4rem 1rem;background:{pipelineRunning ? '#93c5fd' : '#2563eb'};color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:{pipelineRunning ? 'not-allowed' : 'pointer'}"
      >
        {pipelineRunning ? "Running…" : "Run Pipeline"}
      </button>
    </div>
  </div>

  <!-- Pipeline config panel -->
  {#if showConfig && !pipelineRunning}
    <div style="margin-bottom:1.25rem;padding:1rem 1.25rem;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">
      <p style="font-size:0.8rem;font-weight:600;color:#374151;margin:0 0 0.75rem">Pipeline Configuration</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem 1.5rem">

        <!-- Sources -->
        <div style="grid-column:1/-1">
          <label style="font-size:0.75rem;font-weight:500;color:#6b7280;display:block;margin-bottom:0.25rem">Job Boards</label>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            {#each SITE_OPTIONS as site (site)}
              <button
                onclick={() => toggleSite(site)}
                style="padding:0.25rem 0.75rem;border-radius:999px;font-size:0.75rem;font-weight:500;border:1px solid {cfgSites.includes(site) ? '#2563eb' : '#d1d5db'};background:{cfgSites.includes(site) ? '#eff6ff' : '#fff'};color:{cfgSites.includes(site) ? '#2563eb' : '#6b7280'};cursor:pointer"
              >
                {site}
              </button>
            {/each}
          </div>
        </div>

        <!-- Top N -->
        <div>
          <label style="font-size:0.75rem;font-weight:500;color:#6b7280;display:block;margin-bottom:0.25rem">
            Top N jobs to process: <strong>{cfgTopN}</strong>
          </label>
          <input type="range" min="1" max="50" bind:value={cfgTopN}
            style="width:100%;accent-color:#2563eb" />
        </div>

        <!-- Min Score -->
        <div>
          <label style="font-size:0.75rem;font-weight:500;color:#6b7280;display:block;margin-bottom:0.25rem">
            Min suitability score: <strong>{cfgMinScore}</strong>
          </label>
          <input type="range" min="0" max="100" bind:value={cfgMinScore}
            style="width:100%;accent-color:#2563eb" />
        </div>

        <!-- Location -->
        <div>
          <label style="font-size:0.75rem;font-weight:500;color:#6b7280;display:block;margin-bottom:0.25rem">Location</label>
          <input type="text" bind:value={cfgLocation} placeholder="City or leave blank"
            style="width:100%;padding:0.3rem 0.5rem;border:1px solid #d1d5db;border-radius:4px;font-size:0.8rem;box-sizing:border-box" />
        </div>

        <!-- Country -->
        <div>
          <label style="font-size:0.75rem;font-weight:500;color:#6b7280;display:block;margin-bottom:0.25rem">Country code</label>
          <input type="text" bind:value={cfgCountry} placeholder="us"
            style="width:100%;padding:0.3rem 0.5rem;border:1px solid #d1d5db;border-radius:4px;font-size:0.8rem;box-sizing:border-box" />
        </div>

        <!-- Remote -->
        <div style="display:flex;align-items:center;gap:0.5rem">
          <input type="checkbox" id="cfg-remote" bind:checked={cfgRemote} />
          <label for="cfg-remote" style="font-size:0.8rem;color:#374151;cursor:pointer">Remote only</label>
        </div>
      </div>
    </div>
  {/if}

  <!-- Pipeline progress log -->
  {#if pipelineLog.length > 0}
    <div
      style="margin-bottom:1.5rem;padding:0.75rem 1rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:0.8rem;font-family:monospace;max-height:160px;overflow-y:auto"
      aria-label="Pipeline log"
    >
      {#each pipelineLog as line (line)}
        <div>{line}</div>
      {/each}
    </div>
  {/if}

  {#if pipelineError}
    <div
      style="margin-bottom:1.5rem;padding:0.75rem 1rem;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:0.875rem;color:#991b1b"
      role="alert"
    >
      {pipelineError}
    </div>
  {/if}

  <!-- Recent pipeline runs -->
  {#if recentRuns.length > 0 && !pipelineRunning}
    <details style="margin-bottom:1.5rem">
      <summary style="font-size:0.8rem;font-weight:600;color:#6b7280;cursor:pointer;user-select:none;padding:0.3rem 0">
        Recent runs ({recentRuns.length})
      </summary>
      <div style="margin-top:0.5rem;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
        {#each recentRuns as run (run.id)}
          {@const statusColor: Record<string, string> = { completed: "#15803d", failed: "#dc2626", cancelled: "#854d0e", running: "#1d4ed8" }}
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;border-bottom:1px solid #f3f4f6;font-size:0.8rem">
            <div style="display:flex;align-items:center;gap:0.75rem">
              <span style="font-weight:600;color:{statusColor[run.status] ?? '#374151'};text-transform:capitalize">{run.status}</span>
              <span style="color:#9ca3af">{new Date(run.startedAt).toLocaleString()}</span>
            </div>
            <div style="display:flex;gap:1rem;color:#6b7280">
              {#if run.jobsFound > 0}<span>{run.jobsFound} found</span>{/if}
              {#if run.jobsScored > 0}<span>{run.jobsScored} scored</span>{/if}
              {#if run.error}<span style="color:#dc2626;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title={run.error}>{run.error}</span>{/if}
            </div>
          </div>
        {/each}
      </div>
    </details>
  {/if}

  {#if loading}
    <p style="color:#6b7280;text-align:center;padding:2rem">Loading…</p>
  {:else if jobs.length === 0}
    <div style="text-align:center;padding:3rem;border:2px dashed #e5e7eb;border-radius:8px;color:#9ca3af">
      <p style="font-size:1rem;margin:0">No jobs found</p>
      <p style="font-size:0.875rem;margin-top:0.5rem">
        Run the pipeline to discover new jobs, or change the status filter.
      </p>
    </div>
  {:else}
    <div style="display:flex;flex-direction:column;gap:0.75rem">
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
    style="position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:50;display:flex;align-items:center;justify-content:center;padding:1rem"
  >
    <div style="background:#fff;border-radius:10px;width:100%;max-width:580px;box-shadow:0 20px 60px rgba(0,0,0,0.2);display:flex;flex-direction:column;max-height:90vh">
      <!-- Modal header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;border-bottom:1px solid #e5e7eb">
        <h2 style="font-size:1rem;font-weight:700;margin:0">Import Job</h2>
        <button onclick={() => { showImport = false; }} style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:#6b7280;line-height:1">×</button>
      </div>

      <!-- Tab bar -->
      <div style="display:flex;border-bottom:1px solid #e5e7eb;padding:0 1.5rem">
        {#each ([["url","From URL"],["text","Paste Text"],["manual","Manual"]] as const) as [t, label] (t)}
          <button
            onclick={() => { importTab = t; }}
            style="padding:0.75rem 1rem;border:none;background:none;font-size:0.875rem;font-weight:{importTab === t ? 600 : 400};color:{importTab === t ? '#1d4ed8' : '#6b7280'};border-bottom:{importTab === t ? '2px solid #1d4ed8' : '2px solid transparent'};margin-bottom:-1px;cursor:pointer"
          >{label}</button>
        {/each}
      </div>

      <div style="padding:1.25rem 1.5rem;overflow-y:auto;flex:1">
        {#if importError}
          <div style="margin-bottom:1rem;padding:0.6rem 0.75rem;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:0.8rem;color:#dc2626">{importError}</div>
        {/if}

        <!-- From URL -->
        {#if importTab === "url"}
          <label style="display:flex;flex-direction:column;gap:0.4rem;font-size:0.875rem;font-weight:500;color:#374151">
            Job posting URL
            <input
              type="url"
              bind:value={importUrl}
              placeholder="https://linkedin.com/jobs/view/..."
              style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;width:100%;box-sizing:border-box"
            />
          </label>
          <button
            onclick={parseFromUrl}
            disabled={!importUrl.trim() || importParsing}
            style="margin-top:1rem;padding:0.5rem 1.25rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.875rem;cursor:pointer;opacity:{importParsing ? 0.6 : 1}"
          >{importParsing ? "Fetching…" : "Fetch & Parse"}</button>
          <p style="font-size:0.75rem;color:#9ca3af;margin-top:0.5rem">Requires the extractor sidecar to be running.</p>

        <!-- Paste text -->
        {:else if importTab === "text"}
          <label style="display:flex;flex-direction:column;gap:0.4rem;font-size:0.875rem;font-weight:500;color:#374151">
            Paste job description
            <textarea
              bind:value={importText}
              rows="8"
              placeholder="Paste the full job description here…"
              style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;font-family:inherit;resize:vertical;width:100%;box-sizing:border-box"
            ></textarea>
          </label>
          <button
            onclick={parseFromText}
            disabled={importText.trim().length < 50 || importParsing}
            style="margin-top:1rem;padding:0.5rem 1.25rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.875rem;cursor:pointer;opacity:{importParsing ? 0.6 : 1}"
          >{importParsing ? "Parsing…" : "Parse Text"}</button>

        <!-- Manual form -->
        {:else}
          <div style="display:grid;gap:0.75rem">
            <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.8rem;font-weight:500;color:#374151">
              Title <span style="color:#ef4444">*</span>
              <input type="text" bind:value={importForm.title} placeholder="Software Engineer"
                style="padding:0.45rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem" />
            </label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
              <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.8rem;font-weight:500;color:#374151">
                Employer
                <input type="text" bind:value={importForm.employer} placeholder="Acme Corp"
                  style="padding:0.45rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem" />
              </label>
              <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.8rem;font-weight:500;color:#374151">
                Location
                <input type="text" bind:value={importForm.location} placeholder="Remote / New York"
                  style="padding:0.45rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem" />
              </label>
            </div>
            <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.8rem;font-weight:500;color:#374151">
              Job posting URL
              <input type="url" bind:value={importForm.url} placeholder="https://…"
                style="padding:0.45rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem" />
            </label>
            <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.8rem;font-weight:500;color:#374151">
              Job description
              <textarea bind:value={importForm.jobDescription} rows="5" placeholder="Paste or type the job description…"
                style="padding:0.45rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.8rem;font-family:inherit;resize:vertical"></textarea>
            </label>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem">
              <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.8rem;font-weight:500;color:#374151">
                Min salary
                <input type="number" bind:value={importForm.salaryMin} placeholder="60000"
                  style="padding:0.45rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem" />
              </label>
              <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.8rem;font-weight:500;color:#374151">
                Max salary
                <input type="number" bind:value={importForm.salaryMax} placeholder="90000"
                  style="padding:0.45rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem" />
              </label>
              <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.8rem;font-weight:500;color:#374151">
                Currency
                <input type="text" bind:value={importForm.salaryCurrency} placeholder="USD"
                  style="padding:0.45rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem" />
              </label>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem">
              <input type="checkbox" id="imp-remote" bind:checked={importForm.isRemote} />
              <label for="imp-remote" style="font-size:0.875rem;color:#374151;cursor:pointer">Remote</label>
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      {#if importTab === "manual"}
        <div style="padding:1rem 1.5rem;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:0.5rem">
          <button onclick={() => { showImport = false; }}
            style="padding:0.45rem 1rem;background:#f3f4f6;color:#374151;border:none;border-radius:6px;font-size:0.875rem;cursor:pointer">
            Cancel
          </button>
          <button
            onclick={submitImport}
            disabled={!importForm.title.trim() || importSaving}
            style="padding:0.45rem 1.25rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.875rem;cursor:pointer;opacity:{importSaving ? 0.6 : 1}"
          >{importSaving ? "Importing…" : "Import Job"}</button>
        </div>
      {/if}
    </div>
  </div>
{/if}
