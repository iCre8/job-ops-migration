<script lang="ts">
  import type { PageData } from "./$types.js";
  import { trpc } from "$lib/trpc/client.js";

  const { data }: { data: PageData } = $props();

  let analytics = $state(data.analytics);
  let days = $state(data.days);
  let loading = $state(false);

  async function changeDays(d: number) {
    days = d;
    loading = true;
    try {
      analytics = await trpc.analytics.overview.query({ days: d });
    } finally {
      loading = false;
    }
  }

  const STAGE_LABELS: Record<string, string> = {
    applied: "Applied",
    recruiter_screen: "Recruiter Screen",
    assessment: "Assessment",
    hiring_manager_screen: "HM Screen",
    technical_interview: "Technical",
    onsite: "Onsite",
    offer: "Offer",
    closed: "Closed",
  };

  const OUTCOME_LABELS: Record<string, string> = {
    offer_accepted: "Offer Accepted",
    offer_declined: "Offer Declined",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
    no_response: "No Response",
    ghosted: "Ghosted",
  };

  const DURATION_OPTIONS = [7, 14, 30, 90];
</script>

<svelte:head><title>Overview — Job-Ops</title></svelte:head>

<div class="overview-container fade-in">
  <!-- Header -->
  <header class="page-header">
    <div>
      <h1 class="page-title">Overview</h1>
      <p class="page-subtitle">Track your pipeline efficiency and scraping analytics</p>
    </div>
    <div class="filter-group">
      {#each DURATION_OPTIONS as d}
        <button
          onclick={() => changeDays(d)}
          class="filter-btn"
          class:active={days === d}
        >{d}d</button>
      {/each}
    </div>
  </header>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading analytics data...</p>
    </div>
  {:else if !analytics}
    <div class="empty-state">
      <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
      <p>No data available. Run the pipeline to start discovery.</p>
    </div>
  {:else}
    <!-- Stat cards -->
    <section class="stats-grid">
      {#each [
        { label: "Total Jobs Discovered", value: analytics.totals.total, color: "var(--info-text)" },
        { label: "Ready to Apply", value: analytics.totals.ready, color: "var(--accent-text)" },
        { label: "Applied / In-Progress", value: analytics.totals.applied, color: "var(--purple-text)" },
        { label: "Skipped", value: analytics.totals.skipped, color: "var(--text-muted)" },
        { label: "Offer Rate", value: analytics.conversion.rate + "%", color: "var(--success-text)" },
      ] as card}
        <div class="card stat-card card-hover">
          <span class="stat-label">{card.label}</span>
          <span class="stat-value" style="color: {card.color}">{card.value}</span>
        </div>
      {/each}
    </section>

    <!-- Applications per day chart -->
    <section class="card chart-card">
      <h2 class="section-title">Applications per Day</h2>
      <div class="chart-container">
        <div class="bars-wrapper">
          {#each analytics.appsPerDay as bar}
            {@const max = Math.max(...analytics.appsPerDay.map((b) => b.count), 1)}
            {@const pct = Math.round((bar.count / max) * 100)}
            <div class="chart-column" title="{bar.date}: {bar.count} applications">
              <div class="chart-bar-bg">
                <div class="chart-bar" class:active={bar.count > 0} style="height: {pct}%;">
                  {#if bar.count > 0}
                    <span class="bar-value">{bar.count}</span>
                  {/if}
                </div>
              </div>
              <span class="bar-label">{bar.date.split('-')[2]}</span>
            </div>
          {/each}
        </div>
      </div>
      <div class="chart-footer">
        <span>{analytics.appsPerDay[0]?.date ?? ""}</span>
        <span>{analytics.appsPerDay.at(-1)?.date ?? ""}</span>
      </div>
    </section>

    <div class="split-grid">
      <!-- Application Funnel -->
      <section class="card funnel-card">
        <h2 class="section-title">Application Funnel</h2>
        <div class="funnel-list">
          {#each analytics.stageFunnel.filter((s) => s.count > 0) as stage}
            {@const max = Math.max(...analytics.stageFunnel.map((s) => s.count), 1)}
            {@const percentage = Math.round((stage.count / max) * 100)}
            <div class="funnel-item">
              <div class="item-header">
                <span class="item-name">{STAGE_LABELS[stage.stage] ?? stage.stage}</span>
                <span class="item-count">{stage.count}</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar" style="width: {percentage}%; background-color: var(--accent-color);"></div>
              </div>
            </div>
          {/each}
          {#if analytics.stageFunnel.every((s) => s.count === 0)}
            <div class="empty-list">No applications tracked yet.</div>
          {/if}
        </div>
      </section>

      <!-- Response Rate by Source -->
      <section class="card source-card">
        <h2 class="section-title">Response Rate by Source</h2>
        <div class="funnel-list">
          {#if analytics.responseRateBySource.length === 0}
            <div class="empty-list">No response data yet.</div>
          {:else}
            {#each analytics.responseRateBySource.sort((a, b) => b.rate - a.rate) as src}
              <div class="funnel-item">
                <div class="item-header">
                  <span class="item-name">{src.source}</span>
                  <span class="item-count">{src.rate}% <span class="sub-count">({src.responded}/{src.applied})</span></span>
                </div>
                <div class="progress-bar-bg">
                  <div class="progress-bar" style="width: {src.rate}%; background-color: var(--success-color);"></div>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </section>
    </div>

    <!-- Outcomes -->
    {#if Object.keys(analytics.byOutcome).length > 0}
      <section class="card outcome-card">
        <h2 class="section-title">Outcomes</h2>
        <div class="outcomes-wrapper">
          {#each Object.entries(analytics.byOutcome) as [outcome, count]}
            <div class="outcome-pill">
              <span class="outcome-label">{OUTCOME_LABELS[outcome] ?? outcome}</span>
              <span class="outcome-divider"></span>
              <span class="outcome-count">{count}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .overview-container {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
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

  .filter-group {
    display: flex;
    background-color: var(--bg-sidebar);
    border: 1px solid var(--border-color);
    padding: 0.25rem;
    border-radius: var(--radius-md);
  }

  .filter-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    padding: 0.35rem 0.85rem;
    font-size: 0.8rem;
    font-weight: 500;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .filter-btn:hover {
    color: var(--text-primary);
  }

  .filter-btn.active {
    background-color: var(--bg-card);
    color: var(--accent-text);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
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

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.25rem;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .stat-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1.1;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1.25rem;
    letter-spacing: -0.01em;
  }

  .chart-card {
    display: flex;
    flex-direction: column;
  }

  .chart-container {
    height: 180px;
    display: flex;
    align-items: flex-end;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
    margin-bottom: 0.5rem;
    overflow-x: auto;
  }

  .bars-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    height: 100%;
    width: 100%;
    min-width: max-content;
  }

  .chart-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    height: 100%;
    justify-content: flex-end;
  }

  .chart-bar-bg {
    width: 100%;
    max-width: 20px;
    min-width: 12px;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
    display: flex;
    align-items: flex-end;
  }

  .chart-bar {
    width: 100%;
    background-color: var(--border-color);
    border-radius: 4px;
    transition: height var(--transition-normal);
    position: relative;
  }

  .chart-bar.active {
    background: linear-gradient(180deg, var(--accent-hover) 0%, var(--accent-color) 100%);
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
  }

  .bar-value {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .bar-label {
    font-size: 0.65rem;
    color: var(--text-muted);
  }

  .chart-footer {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .split-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.25rem;
  }

  .funnel-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .funnel-item {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.825rem;
  }

  .item-name {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .item-count {
    font-weight: 600;
    color: var(--text-primary);
  }

  .sub-count {
    font-weight: 400;
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  .progress-bar-bg {
    height: 5px;
    background-color: rgba(255, 255, 255, 0.04);
    border-radius: 99px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    border-radius: 99px;
    transition: width var(--transition-normal);
  }

  .empty-list {
    padding: 1.5rem;
    text-align: center;
    font-size: 0.8rem;
    color: var(--text-muted);
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-md);
  }

  .outcomes-wrapper {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
  }

  .outcome-pill {
    display: flex;
    align-items: center;
    background-color: var(--bg-sidebar);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }

  .outcome-label {
    color: var(--text-secondary);
  }

  .outcome-divider {
    width: 1px;
    height: 12px;
    background-color: var(--border-color);
    margin: 0 0.65rem;
  }

  .outcome-count {
    font-weight: 700;
    color: var(--accent-text);
  }
</style>
