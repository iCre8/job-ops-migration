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

<div style="padding:1.5rem;max-width:1100px;margin:0 auto">
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
    <h1 style="font-size:1.4rem;font-weight:700;margin:0">Overview</h1>
    <div style="display:flex;gap:0.4rem">
      {#each DURATION_OPTIONS as d}
        <button
          onclick={() => changeDays(d)}
          style="padding:0.3rem 0.75rem;border-radius:6px;border:1px solid {days === d ? '#0070f3' : '#d1d5db'};background:{days === d ? '#0070f3' : '#fff'};color:{days === d ? '#fff' : '#374151'};font-size:0.8rem;cursor:pointer"
        >{d}d</button>
      {/each}
    </div>
  </div>

  {#if loading}
    <p style="color:#9ca3af;font-size:0.875rem">Loading…</p>
  {:else if !analytics}
    <p style="color:#9ca3af;font-size:0.875rem">No data available. Run the pipeline to start tracking jobs.</p>
  {:else}
    <!-- Stat cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-bottom:1.5rem">
      {#each [
        { label: "Total Jobs", value: analytics.totals.total },
        { label: "Ready to Apply", value: analytics.totals.ready },
        { label: "Applied / In-Progress", value: analytics.totals.applied },
        { label: "Skipped", value: analytics.totals.skipped },
        { label: "Offer Rate", value: analytics.conversion.rate + "%" },
      ] as card}
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem">
          <p style="font-size:0.75rem;color:#6b7280;margin:0 0 0.25rem">{card.label}</p>
          <p style="font-size:1.6rem;font-weight:700;margin:0">{card.value}</p>
        </div>
      {/each}
    </div>

    <!-- Applications per day chart (simple bar) -->
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
      <h2 style="font-size:0.9rem;font-weight:600;margin:0 0 1rem">Applications per Day</h2>
      <div style="display:flex;align-items:flex-end;gap:3px;height:80px;overflow-x:auto">
        {#each analytics.appsPerDay as bar}
          {@const max = Math.max(...analytics.appsPerDay.map((b) => b.count), 1)}
          {@const pct = Math.round((bar.count / max) * 100)}
          <div style="flex:1;min-width:6px;display:flex;flex-direction:column;align-items:center;gap:2px" title="{bar.date}: {bar.count}">
            <div style="width:100%;background:{bar.count > 0 ? '#0070f3' : '#e5e7eb'};height:{pct}%;min-height:2px;border-radius:2px 2px 0 0"></div>
          </div>
        {/each}
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:0.25rem;font-size:0.65rem;color:#9ca3af">
        <span>{analytics.appsPerDay[0]?.date ?? ""}</span>
        <span>{analytics.appsPerDay.at(-1)?.date ?? ""}</span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
      <!-- Application Funnel -->
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem">
        <h2 style="font-size:0.9rem;font-weight:600;margin:0 0 1rem">Application Funnel</h2>
        {#each analytics.stageFunnel.filter((s) => s.count > 0) as stage}
          {@const max = Math.max(...analytics.stageFunnel.map((s) => s.count), 1)}
          <div style="margin-bottom:0.6rem">
            <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:2px">
              <span style="color:#374151">{STAGE_LABELS[stage.stage] ?? stage.stage}</span>
              <span style="font-weight:600">{stage.count}</span>
            </div>
            <div style="background:#f3f4f6;border-radius:3px;height:6px">
              <div style="background:#0070f3;height:100%;border-radius:3px;width:{Math.round((stage.count/max)*100)}%"></div>
            </div>
          </div>
        {/each}
        {#if analytics.stageFunnel.every((s) => s.count === 0)}
          <p style="font-size:0.8rem;color:#9ca3af">No applications tracked yet.</p>
        {/if}
      </div>

      <!-- Response Rate by Source -->
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem">
        <h2 style="font-size:0.9rem;font-weight:600;margin:0 0 1rem">Response Rate by Source</h2>
        {#if analytics.responseRateBySource.length === 0}
          <p style="font-size:0.8rem;color:#9ca3af">No data yet.</p>
        {:else}
          {#each analytics.responseRateBySource.sort((a, b) => b.rate - a.rate) as src}
            <div style="margin-bottom:0.6rem">
              <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:2px">
                <span style="color:#374151">{src.source}</span>
                <span style="font-weight:600">{src.rate}% <span style="font-weight:400;color:#6b7280">({src.responded}/{src.applied})</span></span>
              </div>
              <div style="background:#f3f4f6;border-radius:3px;height:6px">
                <div style="background:#10b981;height:100%;border-radius:3px;width:{src.rate}%"></div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Outcomes -->
    {#if Object.keys(analytics.byOutcome).length > 0}
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem">
        <h2 style="font-size:0.9rem;font-weight:600;margin:0 0 1rem">Outcomes</h2>
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem">
          {#each Object.entries(analytics.byOutcome) as [outcome, count]}
            <div style="background:#f3f4f6;border-radius:6px;padding:0.3rem 0.75rem;font-size:0.8rem">
              <span style="color:#374151">{OUTCOME_LABELS[outcome] ?? outcome}</span>
              <span style="font-weight:700;margin-left:0.4rem">{count}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>
