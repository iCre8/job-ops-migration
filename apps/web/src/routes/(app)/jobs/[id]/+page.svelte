<script lang="ts">
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
  const { job } = data;

  function formatSalary(): string | null {
    if (!job.salaryMin && !job.salaryMax) return null;
    const cur = job.salaryCurrency ?? "";
    const period = job.salaryPeriod ? `/${job.salaryPeriod}` : "";
    const min = job.salaryMin ? `${cur}${job.salaryMin.toLocaleString()}` : null;
    const max = job.salaryMax ? `${cur}${job.salaryMax.toLocaleString()}` : null;
    if (min && max) return `${min} – ${max}${period}`;
    return `${min ?? max}${period}`;
  }

  function statusColour(s: string): string {
    const map: Record<string, string> = {
      ready: "#1d4ed8",
      applied: "#15803d",
      discovered: "#374151",
      skipped: "#854d0e",
      expired: "#991b1b",
    };
    return map[s] ?? "#374151";
  }

  const salary = formatSalary();
</script>

<svelte:head>
  <title>{job.title ?? "Job"} — Job-Ops</title>
</svelte:head>

<div style="padding:2rem;max-width:860px;margin:0 auto">
  <!-- Back -->
  <a
    href="/jobs"
    style="font-size:0.875rem;color:#6b7280;text-decoration:none;display:inline-block;margin-bottom:1.25rem"
  >
    ← Back to Jobs
  </a>

  <!-- Header -->
  <div style="margin-bottom:1.5rem">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap">
      <div>
        <h1 style="font-size:1.6rem;font-weight:700;margin:0">{job.title ?? "Untitled"}</h1>
        {#if job.employer}
          <p style="font-size:1rem;color:#6b7280;margin:0.25rem 0 0">{job.employer}</p>
        {/if}
      </div>
      <span
        style="font-size:0.8rem;font-weight:600;padding:0.3rem 0.8rem;border-radius:6px;background:#f3f4f6;color:{statusColour(job.status)}"
      >
        {job.status}
      </span>
    </div>
  </div>

  <!-- Meta strip -->
  <div
    style="display:flex;flex-wrap:wrap;gap:1rem;font-size:0.875rem;color:#6b7280;padding:0.75rem 1rem;background:#f9fafb;border-radius:6px;margin-bottom:1.5rem"
  >
    {#if job.location}
      <span>📍 {job.location}{job.isRemote ? " · Remote" : ""}</span>
    {:else if job.isRemote}
      <span>📍 Remote</span>
    {/if}
    {#if job.jobType}
      <span>🗂 {job.jobType}</span>
    {/if}
    {#if salary}
      <span>💰 {salary}</span>
    {/if}
    {#if job.scoreOverall !== null}
      <span>⭐ Score: <strong>{Math.round(job.scoreOverall)}</strong></span>
    {/if}
    {#if job.appliedAt}
      <span>✅ Applied: {new Date(job.appliedAt).toLocaleDateString()}</span>
    {/if}
  </div>

  <!-- PDF download -->
  {#if job.pdfPublicUrl}
    <div style="margin-bottom:1.5rem">
      <a
        href={job.pdfPublicUrl}
        target="_blank"
        rel="noopener noreferrer"
        style="display:inline-block;padding:0.5rem 1.2rem;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-size:0.875rem;font-weight:600"
      >
        Download Tailored Resume (PDF)
      </a>
    </div>
  {/if}

  <!-- AI reasoning -->
  {#if job.scoreReasoning}
    <section style="margin-bottom:1.5rem">
      <h2 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">AI Reasoning</h2>
      <p style="font-size:0.875rem;color:#374151;line-height:1.6;white-space:pre-wrap">{job.scoreReasoning}</p>
    </section>
  {/if}

  <!-- Tailored summary -->
  {#if job.tailoredSummary}
    <section style="margin-bottom:1.5rem">
      <h2 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">Tailored Summary</h2>
      <p style="font-size:0.875rem;color:#374151;line-height:1.6">{job.tailoredSummary}</p>
    </section>
  {/if}

  <!-- Job description -->
  {#if job.jobDescription}
    <section style="margin-bottom:1.5rem">
      <h2 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">Job Description</h2>
      <div
        style="font-size:0.875rem;color:#374151;line-height:1.7;white-space:pre-wrap;max-height:400px;overflow-y:auto;padding:1rem;background:#f9fafb;border-radius:6px"
      >
        {job.jobDescription}
      </div>
    </section>
  {/if}

  <!-- External link -->
  {#if job.url}
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      style="font-size:0.875rem;color:#2563eb"
    >
      View original posting ↗
    </a>
  {/if}
</div>
