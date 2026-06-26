<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { trpc } from "$lib/trpc/client.js";
  import type { PageData } from "./$types.js";

  const { data }: { data: PageData } = $props();
  let sources = $state(data.sources);
  let results = $state(data.results);
  $effect(() => { sources = data.sources; results = data.results; });

  // Filter and loading states
  let decisionFilter = $state<"unseen" | "imported" | "ignored" | "all">("unseen");
  let sourceFilter = $state("");
  let loadingResults = $state(false);
  let decidingId = $state<string | null>(null);

  // New source states
  let newSourceId = $state("");
  let newLabel = $state("");
  let saving = $state(false);
  let sourceError = $state<string | null>(null);

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

  function getSourceTypeLabel(sourceId: string): string {
    const lower = sourceId.toLowerCase();
    if (lower.includes("greenhouse")) return "Greenhouse";
    if (lower.includes("workday")) return "Workday";
    if (lower.includes("bamboohr")) return "BambooHR";
    return "Custom";
  }
</script>

<svelte:head>
  <title>Watchlist — Job-Ops</title>
</svelte:head>

<div class="watchlist-container fade-in">
  <!-- Header -->
  <header class="page-header">
    <div class="header-left">
      <h1>Watchlist</h1>
      <p class="subtitle">Monitor and import jobs from configured company career boards</p>
    </div>
  </header>

  <div class="watchlist-layout">
    <!-- Main Content: Discovered Jobs List -->
    <main class="results-section">
      <div class="card card-hover filter-card">
        <div class="filter-bar">
          <div class="filter-group">
            <span class="filter-label">Filter Decision</span>
            <select
              bind:value={decisionFilter}
              onchange={loadResults}
              class="select select-custom"
            >
              <option value="unseen">Unseen</option>
              <option value="imported">Imported</option>
              <option value="ignored">Ignored</option>
              <option value="all">All</option>
            </select>
          </div>

          <div class="filter-group">
            <span class="filter-label">Filter Source</span>
            <select
              bind:value={sourceFilter}
              onchange={loadResults}
              class="select select-custom"
            >
              <option value="">All Sources</option>
              {#each sources as src (src.id)}
                <option value={src.sourceId}>{src.label}</option>
              {/each}
            </select>
          </div>

          <div class="job-count-badge">
            {results.length} Opportunity{results.length === 1 ? "" : "ies"}
          </div>
        </div>
      </div>

      {#if loadingResults}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading opportunities...</p>
        </div>
      {:else if results.length === 0}
        <div class="empty-state card">
          <div class="empty-icon">📂</div>
          <h3>No opportunities found</h3>
          <p>
            {decisionFilter === "unseen" 
              ? "No new watchlist jobs match. Run the crawler pipeline to discover new postings." 
              : "No jobs match the selected filter criteria."}
          </p>
        </div>
      {:else}
        <div class="jobs-list">
          {#each results as job (job.id)}
            <div class="job-item card card-hover">
              <div class="job-info">
                <div class="job-header">
                  <h3>{job.title ?? "(Untitled Role)"}</h3>
                  <div class="badge-row">
                    <span class="badge badge-discovered">
                      {sourceLabel(job.sourceId)}
                    </span>
                    <span class="badge-type">
                      {getSourceTypeLabel(job.sourceId)}
                    </span>
                  </div>
                </div>
                <div class="job-meta">
                  <span class="employer">{job.employer ?? "Unknown Company"}</span>
                  {#if job.location}
                    <span class="separator">•</span>
                    <span class="location">{job.location}</span>
                  {/if}
                  {#if job.postedAt}
                    <span class="separator">•</span>
                    <span class="date">{formatDate(job.postedAt)}</span>
                  {/if}
                </div>
              </div>

              <div class="job-actions">
                {#if job.decision}
                  <span class="badge {job.decision === 'imported' ? 'badge-applied' : 'badge-skipped'}">
                    {job.decision}
                  </span>
                {:else}
                  {#if job.url}
                    <a href={job.url} target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
                      View Board
                    </a>
                  {/if}
                  <button
                    onclick={() => decide(job.id, "imported")}
                    disabled={decidingId === job.id}
                    class="btn btn-primary btn-sm"
                  >
                    Import
                  </button>
                  <button
                    onclick={() => decide(job.id, "ignored")}
                    disabled={decidingId === job.id}
                    class="btn btn-secondary btn-sm ignore-btn"
                  >
                    Ignore
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </main>

    <!-- Sidebar: Sources Management -->
    <aside class="sources-sidebar">
      <!-- Add Source Form -->
      <div class="card add-source-card">
        <h2>Add Career Board</h2>
        <p class="description">Add a custom company board source to monitor</p>

        {#if sourceError}
          <div class="error-banner">{sourceError}</div>
        {/if}

        <div class="form-layout">
          <div class="form-group">
            <span class="form-label">Source ID</span>
            <input
              type="text"
              bind:value={newSourceId}
              placeholder="e.g. greenhouse:stripe"
              class="input"
            />
          </div>

          <div class="form-group">
            <span class="form-label">Display Label</span>
            <input
              type="text"
              bind:value={newLabel}
              placeholder="e.g. Stripe"
              class="input"
            />
          </div>

          <button
            onclick={addSource}
            disabled={saving || !newSourceId.trim() || !newLabel.trim()}
            class="btn btn-primary w-full"
          >
            {saving ? "Adding..." : "Add Source"}
          </button>
        </div>
      </div>

      <!-- Configured Sources List -->
      <div class="card sources-list-card">
        <h2>Active Sources</h2>
        <p class="description">Enable or disable monitoring boards</p>

        {#if sources.length === 0}
          <div class="empty-sources">No sources configured yet.</div>
        {:else}
          <div class="sources-list">
            {#each sources as source (source.id)}
              <div class="source-item">
                <div class="source-details">
                  <div class="source-title-row">
                    <span class="source-name">{source.label}</span>
                    <span class="source-type-badge">{getSourceTypeLabel(source.sourceId)}</span>
                  </div>
                  <span class="source-id">{source.sourceId}</span>
                </div>

                <div class="source-controls">
                  <label class="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={source.enabled} 
                      onchange={() => toggle(source.sourceId)} 
                    />
                    <span class="toggle-slider"></span>
                  </label>

                  <button 
                    onclick={() => removeSource(source.sourceId)} 
                    class="remove-btn" 
                    title="Remove Source"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </aside>
  </div>
</div>

<style>
  .watchlist-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem;
  }

  .page-header {
    margin-bottom: 2rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 1.5rem;
  }

  .page-header h1 {
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    margin-bottom: 0.25rem;
    background: linear-gradient(135deg, var(--text-primary) 30%, var(--text-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--text-secondary);
  }

  .watchlist-layout {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 2rem;
    align-items: start;
  }

  @media (max-width: 960px) {
    .watchlist-layout {
      grid-template-columns: 1fr;
    }
  }

  .filter-card {
    margin-bottom: 1.5rem;
    padding: 1rem 1.25rem;
  }

  .filter-bar {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .filter-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .select-custom {
    min-width: 140px;
    height: 38px;
    cursor: pointer;
  }

  .job-count-badge {
    margin-left: auto;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--bg-input);
    padding: 0.4rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);
  }

  @media (max-width: 640px) {
    .job-count-badge {
      margin-left: 0;
      width: 100%;
      text-align: center;
    }
  }

  .jobs-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .job-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
    padding: 1.25rem;
    animation: fadeIn var(--transition-normal) forwards;
  }

  @media (max-width: 640px) {
    .job-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }
    .job-actions {
      width: 100%;
      justify-content: flex-end;
    }
  }

  .job-info {
    flex: 1;
    min-width: 0;
  }

  .job-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.35rem;
  }

  .job-header h3 {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .badge-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .badge-type {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--purple-text);
    background: var(--purple-bg);
    border: 1px solid var(--purple-border);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }

  .job-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .separator {
    color: var(--text-muted);
  }

  .job-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .ignore-btn:hover {
    color: var(--danger-text) !important;
    border-color: var(--danger-border) !important;
    background: var(--danger-bg) !important;
  }

  .loading-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-secondary);
  }

  .spinner {
    border: 3px solid var(--border-color);
    border-top: 3px solid var(--accent-color);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .empty-state {
    text-align: center;
    padding: 5rem 2rem;
    color: var(--text-secondary);
  }

  .empty-icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    opacity: 0.6;
  }

  .empty-state h3 {
    font-size: 1.15rem;
    margin-bottom: 0.5rem;
  }

  .empty-state p {
    font-size: 0.9rem;
    max-width: 400px;
    margin: 0 auto;
    color: var(--text-muted);
  }

  /* Sources Sidebar Styling */
  .sources-sidebar {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .add-source-card h2, .sources-list-card h2 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.2rem;
  }

  .description {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 1.25rem;
  }

  .error-banner {
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    color: var(--danger-text);
    padding: 0.6rem 0.8rem;
    border-radius: var(--radius-md);
    font-size: 0.8rem;
    margin-bottom: 1rem;
  }

  .form-layout {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .w-full {
    width: 100%;
  }

  .sources-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .source-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0.85rem;
    background: var(--bg-input);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
  }

  .source-details {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .source-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .source-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .source-type-badge {
    font-size: 0.65rem;
    font-weight: 500;
    color: var(--accent-text);
    background: var(--accent-bg);
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
  }

  .source-id {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .source-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .remove-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.2rem;
    opacity: 0.6;
    transition: opacity var(--transition-fast), transform var(--transition-fast);
  }

  .remove-btn:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  .empty-sources {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-align: center;
    padding: 1.5rem;
  }

  /* Custom Toggle Slider Switch */
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--border-color);
    transition: .2s;
    border-radius: 20px;
  }

  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: var(--text-secondary);
    transition: .2s;
    border-radius: 50%;
  }

  input:checked + .toggle-slider {
    background-color: var(--accent-color);
  }

  input:checked + .toggle-slider:before {
    transform: translateX(16px);
    background-color: #ffffff;
  }
</style>
