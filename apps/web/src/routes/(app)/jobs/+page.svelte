<script lang="ts">
  import JobCard from "$lib/components/JobCard.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  const STATUS_OPTIONS = [
    { value: "ready", label: "Ready" },
    { value: "applied", label: "Applied" },
    { value: "discovered", label: "Discovered" },
    { value: "in_progress", label: "In Progress" },
    { value: "skipped", label: "Skipped" },
    { value: "expired", label: "Expired" },
  ];

  let jobs = $state(data.jobs);
  let total = $state(data.total);
  let status = $state(data.status);
  let loading = $state(false);

  // ── Pipeline ──────────────────────────────────────────────────────────────
  let pipelineRunning = $state(false);
  let pipelineLog: string[] = $state([]);
  let pipelineError = $state("");

  async function refetch() {
    loading = true;
    try {
      const input = encodeURIComponent(
        JSON.stringify({ "0": { json: { status, page: 1, pageSize: 50 } } }),
      );
      const res = await fetch(`/api/trpc/jobs.list?batch=1&input=${input}`);
      if (res.ok) {
        const [result] = (await res.json()) as [{ result: { data: { json: { jobs: typeof jobs; total: number } } } }];
        jobs = result.result.data.json.jobs;
        total = result.result.data.json.total;
      }
    } finally {
      loading = false;
    }
  }

  function onStatusChange(e: Event) {
    status = (e.target as HTMLSelectElement).value;
    refetch();
  }

  async function runPipeline() {
    pipelineRunning = true;
    pipelineLog = [];
    pipelineError = "";

    let runId: string;
    try {
      // Trigger via tRPC mutation (batch POST)
      const res = await fetch("/api/trpc/pipeline.trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "0": { json: { triggeredBy: "manual" } } }),
      });
      if (!res.ok) throw new Error(`Trigger failed: ${res.status}`);
      const [result] = (await res.json()) as [{ result: { data: { json: { id: string } } } }];
      runId = result.result.data.json.id;
    } catch (err) {
      pipelineError = err instanceof Error ? err.message : "Failed to start pipeline";
      pipelineRunning = false;
      return;
    }

    pipelineLog = [`[${new Date().toLocaleTimeString()}] Pipeline started (run ${runId.slice(-6)})`];

    // Open SSE connection for live progress
    const es = new EventSource(`/api/pipeline/stream?runId=${runId}`);

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as { type: string; message: string };
        pipelineLog = [...pipelineLog, `[${new Date().toLocaleTimeString()}] ${evt.message}`];
        if (evt.type === "complete") {
          pipelineRunning = false;
          es.close();
          refetch();
        } else if (evt.type === "error") {
          pipelineError = evt.message;
          pipelineRunning = false;
          es.close();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      // SSE closes when the run ends server-side — not necessarily an error
      if (pipelineRunning) {
        pipelineRunning = false;
        pipelineLog = [...pipelineLog, `[${new Date().toLocaleTimeString()}] Stream closed`];
      }
      es.close();
    };
  }
</script>

<svelte:head>
  <title>Jobs — Job-Ops</title>
</svelte:head>

<div style="padding:2rem;max-width:900px;margin:0 auto">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
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
        onclick={runPipeline}
        disabled={pipelineRunning}
        aria-label="Run pipeline"
        style="padding:0.4rem 1rem;background:{pipelineRunning ? '#93c5fd' : '#2563eb'};color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:{pipelineRunning ? 'not-allowed' : 'pointer'}"
      >
        {pipelineRunning ? "Running…" : "Run Pipeline"}
      </button>
    </div>
  </div>

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

  {#if loading}
    <p style="color:#6b7280;text-align:center;padding:2rem">Loading…</p>
  {:else if jobs.length === 0}
    <div
      style="text-align:center;padding:3rem;border:2px dashed #e5e7eb;border-radius:8px;color:#9ca3af"
    >
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
