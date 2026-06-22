<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { trpc } from "$lib/trpc/client.js";
  import type { PageData } from "./$types.js";

  const { data }: { data: PageData } = $props();
  let sources = $state(data.sources);
  let results = $state(data.results);
  $effect(() => { sources = data.sources; results = data.results; });

  let activeTab = $state<"sources" | "results">("results");

  // Sources tab state
  let newSourceId = $state("");
  let newLabel = $state("");
  let saving = $state(false);
  let sourceError = $state<string | null>(null);

  // Results tab state
  let decisionFilter = $state<"unseen" | "imported" | "ignored" | "all">("unseen");
  let sourceFilter = $state("");
  let loadingResults = $state(false);
  let decidingId = $state<string | null>(null);

  async function toggle(sourceId: string) {
    await trpc.watchlist.sources.toggle.mutate({ sourceId });
    await invalidateAll();
  }

  async function addSource() {
    if (!newSourceId.trim() || !newLabel.trim()) return;
    saving = true;
    sourceError = null;
    try {
      await trpc.watchlist.sources.upsert.mutate({
        sourceId: newSourceId.trim(),
        label: newLabel.trim(),
        enabled: true,
      });
      newSourceId = "";
      newLabel = "";
      await invalidateAll();
    } catch (e) {
      sourceError = e instanceof Error ? e.message : "Failed to add source";
    } finally {
      saving = false;
    }
  }

  async function removeSource(sourceId: string) {
    await trpc.watchlist.sources.delete.mutate({ sourceId });
    await invalidateAll();
  }

  async function loadResults() {
    loadingResults = true;
    try {
      const res = await trpc.watchlist.results.list.query({
        decision: decisionFilter,
        sourceId: sourceFilter || undefined,
        limit: 50,
      });
      results = res.items;
    } finally {
      loadingResults = false;
    }
  }

  async function decide(id: string, decision: "imported" | "ignored") {
    decidingId = id;
    try {
      await trpc.watchlist.results.decide.mutate({ id, decision });
      results = results.filter((r) => r.id !== id);
    } finally {
      decidingId = null;
    }
  }

  function sourceLabel(sourceId: string): string {
    return sources.find((s) => s.sourceId === sourceId)?.label ?? sourceId;
  }

  function formatDate(d: Date | string | null | undefined): string {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
</script>

<svelte:head>
  <title>Watchlist — Job-Ops</title>
</svelte:head>

<div style="padding:2rem;max-width:800px;margin:0 auto">
  <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:1.5rem">
    <h1 style="font-size:1.3rem;font-weight:700;margin:0">Watchlist</h1>
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:0;border-bottom:2px solid #e5e7eb;margin-bottom:1.5rem">
    {#each [["results","Results"], ["sources","Sources"]] as [tab, label]}
      <button
        onclick={() => { activeTab = tab as "results" | "sources"; }}
        style="padding:0.5rem 1.25rem;border:none;background:none;font-size:0.875rem;font-weight:{activeTab === tab ? 700 : 400};color:{activeTab === tab ? '#1d4ed8' : '#6b7280'};border-bottom:{activeTab === tab ? '2px solid #1d4ed8' : '2px solid transparent'};margin-bottom:-2px;cursor:pointer"
      >{label}</button>
    {/each}
  </div>

  <!-- Results tab -->
  {#if activeTab === "results"}
    <!-- Filters -->
    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem">
      <select
        bind:value={decisionFilter}
        onchange={loadResults}
        style="padding:0.4rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem"
      >
        <option value="unseen">Unseen</option>
        <option value="imported">Imported</option>
        <option value="ignored">Ignored</option>
        <option value="all">All</option>
      </select>

      <select
        bind:value={sourceFilter}
        onchange={loadResults}
        style="padding:0.4rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem"
      >
        <option value="">All sources</option>
        {#each sources as src (src.id)}
          <option value={src.sourceId}>{src.label}</option>
        {/each}
      </select>

      <span style="font-size:0.8rem;color:#9ca3af">{results.length} job{results.length === 1 ? "" : "s"}</span>
    </div>

    {#if loadingResults}
      <p style="color:#9ca3af;font-size:0.875rem">Loading…</p>
    {:else if results.length === 0}
      <div style="text-align:center;padding:3rem;color:#9ca3af">
        <p style="margin:0;font-size:0.875rem">
          {decisionFilter === "unseen" ? "No new watchlist jobs found. Run the pipeline to discover new listings." : "No jobs match this filter."}
        </p>
      </div>
    {:else}
      <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        {#each results as job (job.id)}
          <div style="display:flex;align-items:flex-start;gap:1rem;padding:0.85rem 1rem;border-bottom:1px solid #f3f4f6">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
                <p style="font-weight:600;font-size:0.875rem;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px">
                  {job.title ?? "(untitled)"}
                </p>
                <span style="font-size:0.7rem;background:#f3f4f6;color:#6b7280;padding:0.1rem 0.4rem;border-radius:4px;white-space:nowrap">
                  {sourceLabel(job.sourceId)}
                </span>
              </div>
              <p style="font-size:0.8rem;color:#6b7280;margin:0.15rem 0 0">
                {[job.employer, job.location].filter(Boolean).join(" · ")}
                {#if job.postedAt}
                  <span style="color:#9ca3af"> · {formatDate(job.postedAt)}</span>
                {/if}
              </p>
            </div>

            <div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0">
              {#if job.decision}
                <span style="font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:4px;background:{job.decision === 'imported' ? '#dcfce7' : '#f3f4f6'};color:{job.decision === 'imported' ? '#15803d' : '#6b7280'}">
                  {job.decision}
                </span>
              {:else}
                {#if job.url}
                  <a href={job.url} target="_blank" rel="noopener noreferrer"
                    style="font-size:0.75rem;color:#1d4ed8;text-decoration:none">View</a>
                {/if}
                <button
                  onclick={() => decide(job.id, "imported")}
                  disabled={decidingId === job.id}
                  style="padding:0.25rem 0.6rem;background:#1d4ed8;color:#fff;border:none;border-radius:5px;font-size:0.75rem;cursor:pointer;opacity:{decidingId === job.id ? 0.6 : 1}"
                >Import</button>
                <button
                  onclick={() => decide(job.id, "ignored")}
                  disabled={decidingId === job.id}
                  style="padding:0.25rem 0.6rem;background:#f3f4f6;color:#6b7280;border:none;border-radius:5px;font-size:0.75rem;cursor:pointer"
                >Ignore</button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}

  <!-- Sources tab -->
  {:else}
    <p style="color:#6b7280;font-size:0.875rem;margin:0 0 1rem">Configure job board sources to monitor during pipeline runs.</p>

    {#if sourceError}
      <div style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:0.5rem 0.75rem;border-radius:6px;font-size:0.875rem;margin-bottom:1rem">{sourceError}</div>
    {/if}

    {#if sources.length === 0}
      <p style="color:#9ca3af;font-size:0.875rem;margin-bottom:1rem">No sources configured yet.</p>
    {:else}
      <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:1.5rem">
        {#each sources as source (source.id)}
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;border-bottom:1px solid #f3f4f6">
            <div>
              <p style="font-weight:500;font-size:0.875rem;margin:0">{source.label}</p>
              <p style="font-size:0.75rem;color:#9ca3af;margin:0">{source.sourceId}</p>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem">
              <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;font-size:0.875rem;color:#374151">
                <input type="checkbox" checked={source.enabled} onchange={() => toggle(source.sourceId)} style="cursor:pointer" />
                {source.enabled ? "Enabled" : "Disabled"}
              </label>
              <button onclick={() => removeSource(source.sourceId)} style="font-size:0.75rem;color:#dc2626;background:none;border:none;cursor:pointer;padding:0">Remove</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Add source -->
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:1rem">
      <h2 style="font-size:0.875rem;font-weight:600;margin:0 0 0.75rem">Add Source</h2>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <input
          type="text"
          bind:value={newSourceId}
          placeholder="Source ID (e.g. linkedin)"
          style="flex:1;min-width:140px;padding:0.4rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem"
        />
        <input
          type="text"
          bind:value={newLabel}
          placeholder="Display name"
          style="flex:1;min-width:140px;padding:0.4rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem"
        />
        <button
          onclick={addSource}
          disabled={saving || !newSourceId.trim() || !newLabel.trim()}
          style="padding:0.4rem 1rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.875rem;cursor:pointer"
        >{saving ? "Saving…" : "Add"}</button>
      </div>
    </div>
  {/if}
</div>
