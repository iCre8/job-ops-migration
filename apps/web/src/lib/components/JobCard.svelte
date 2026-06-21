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

  function scoreColour(score: number): string {
    if (score >= 80) return "#16a34a";
    if (score >= 60) return "#ca8a04";
    return "#dc2626";
  }

  function statusBadgeStyle(s: string): string {
    const map: Record<string, string> = {
      ready: "background:#dbeafe;color:#1d4ed8",
      applied: "background:#dcfce7;color:#15803d",
      discovered: "background:#f3f4f6;color:#374151",
      skipped: "background:#fef9c3;color:#854d0e",
      expired: "background:#fee2e2;color:#991b1b",
      processing: "background:#ede9fe;color:#7c3aed",
    };
    return map[s] ?? "background:#f3f4f6;color:#374151";
  }

  const salary = formatSalary();
</script>

<article
  style="border:1px solid #e5e7eb;border-radius:8px;padding:1rem 1.25rem;display:flex;flex-direction:column;gap:0.5rem;background:#fff"
>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem">
    <div style="flex:1;min-width:0">
      <a
        href="/jobs/{job.id}"
        style="font-size:1.05rem;font-weight:600;color:#111;text-decoration:none;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
      >
        {job.title ?? "Untitled"}
      </a>
      {#if job.employer}
        <span style="font-size:0.875rem;color:#6b7280">{job.employer}</span>
      {/if}
    </div>
    <div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0">
      {#if job.scoreOverall !== null}
        <span
          style="font-size:0.8rem;font-weight:700;padding:0.15rem 0.5rem;border-radius:999px;background:#f9fafb;border:1px solid #e5e7eb;color:{scoreColour(job.scoreOverall)}"
        >
          {Math.round(job.scoreOverall)}
        </span>
      {/if}
      <span
        style="font-size:0.75rem;padding:0.2rem 0.6rem;border-radius:4px;{statusBadgeStyle(job.status)}"
      >
        {job.status}
      </span>
    </div>
  </div>

  <div style="display:flex;flex-wrap:wrap;gap:0.75rem;font-size:0.8rem;color:#6b7280">
    {#if job.location}
      <span>{job.location}{job.isRemote ? " · Remote" : ""}</span>
    {:else if job.isRemote}
      <span>Remote</span>
    {/if}
    {#if salary}
      <span>{salary}</span>
    {/if}
    {#if job.applicationStage}
      <span style="color:#7c3aed">Stage: {job.applicationStage}</span>
    {/if}
    <span style="margin-left:auto">{job.source}</span>
  </div>

  {#if job.pdfPublicUrl}
    <div style="padding-top:0.25rem">
      <a
        href={job.pdfPublicUrl}
        target="_blank"
        rel="noopener noreferrer"
        style="font-size:0.8rem;color:#2563eb;text-decoration:none"
        onclick={onaction}
      >
        Download PDF
      </a>
    </div>
  {/if}
</article>
