<script lang="ts">
  interface Job {
    id: string;
    title: string | null;
    employer: string | null;
    location: string | null;
    status: string;
    scoreOverall: number | null;
    isRemote: boolean;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string | null;
    pdfPublicUrl: string | null;
    applicationStage: string | null;
    source: string;
    crawledAt: Date | string | null;
  }

  interface Props {
    job: Job;
    onaction?: () => void;
  }

  const { job, onaction }: Props = $props();

  function formatSalary(): string | null {
    if (!job.salaryMin && !job.salaryMax) return null;
    const currency = job.salaryCurrency ?? "";
    const min = job.salaryMin ? `${currency}${Math.round(job.salaryMin / 1000)}k` : null;
    const max = job.salaryMax ? `${currency}${Math.round(job.salaryMax / 1000)}k` : null;
    if (min && max) return `${min} – ${max}`;
    return min ?? max ?? null;
  }

  const salary = formatSalary();
</script>

<article class="card job-card card-hover fade-in">
  <div class="card-top">
    <div class="job-identity">
      <a href="/jobs/{job.id}" class="job-title-link">
        {job.title ?? "Untitled Role"}
      </a>
      {#if job.employer}
        <span class="employer-name">{job.employer}</span>
      {/if}
    </div>
    
    <div class="job-badges">
      {#if job.scoreOverall !== null}
        {@const score = Math.round(job.scoreOverall)}
        <span 
          class="score-badge" 
          class:high-score={score >= 80} 
          class:mid-score={score >= 60 && score < 80} 
          class:low-score={score < 60}
          title="Suitability Score"
        >
          {score}
        </span>
      {/if}
      <span 
        class="badge"
        class:badge-ready={job.status === "ready"}
        class:badge-applied={job.status === "applied"}
        class:badge-discovered={job.status === "discovered" || job.status === "processing"}
        class:badge-skipped={job.status === "skipped"}
        class:badge-expired={job.status === "expired"}
      >
        {job.status}
      </span>
    </div>
  </div>

  <div class="job-details-row">
    {#if job.location}
      <span class="detail-item">
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        {job.location}
        {#if job.isRemote}
          <span class="remote-pill">Remote</span>
        {/if}
      </span>
    {:else if job.isRemote}
      <span class="detail-item">
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        Remote
      </span>
    {/if}

    {#if salary}
      <span class="detail-item salary-detail">
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
        {salary}
      </span>
    {/if}

    {#if job.applicationStage}
      <span class="detail-item stage-detail">
        <span class="stage-indicator-dot"></span>
        Stage: {job.applicationStage}
      </span>
    {/if}

    <span class="source-tag">{job.source}</span>
  </div>

  {#if job.pdfPublicUrl}
    <div class="card-actions">
      <a
        href={job.pdfPublicUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="download-link"
        onclick={onaction}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download PDF Summary
      </a>
    </div>
  {/if}
</article>

<style>
  .job-card {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1.5rem;
  }

  .job-identity {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .job-title-link {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-primary);
    text-decoration: none;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color var(--transition-fast);
  }

  .job-title-link:hover {
    color: var(--accent-text);
  }

  .employer-name {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .job-badges {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .score-badge {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background-color: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-color);
  }

  .high-score {
    color: var(--success-text);
    border-color: var(--success-border);
    background-color: var(--success-bg);
  }

  .mid-score {
    color: var(--warning-text);
    border-color: var(--warning-border);
    background-color: var(--warning-bg);
  }

  .low-score {
    color: var(--danger-text);
    border-color: var(--danger-border);
    background-color: var(--danger-bg);
  }

  .job-details-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.85rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .detail-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .remote-pill {
    background-color: var(--info-bg);
    border: 1px solid var(--info-border);
    color: var(--info-text);
    font-size: 0.7rem;
    padding: 0.05rem 0.35rem;
    border-radius: 4px;
    margin-left: 0.35rem;
    font-weight: 500;
  }

  .salary-detail {
    color: var(--success-text);
  }

  .stage-detail {
    color: var(--purple-text);
    background-color: var(--purple-bg);
    border: 1px solid var(--purple-border);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .source-tag {
    margin-left: auto;
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--text-muted);
    background-color: rgba(255, 255, 255, 0.02);
    padding: 0.1rem 0.4rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);
  }

  .card-actions {
    border-top: 1px solid var(--border-color);
    padding-top: 0.65rem;
    margin-top: 0.25rem;
  }

  .download-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: var(--accent-text);
    font-weight: 500;
    text-decoration: none;
    transition: color var(--transition-fast);
  }

  .download-link:hover {
    color: var(--accent-hover);
  }
</style>
