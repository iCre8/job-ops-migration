<script lang="ts">
  import type { PageData } from "./$types.js";

  const { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Tracer Links — Job-Ops</title>
</svelte:head>

<div style="padding:2rem;max-width:860px;margin:0 auto">
  <h1 style="font-size:1.3rem;font-weight:700;margin:0 0 1.5rem">Tracer Link Analytics</h1>

  {#if data.jobs.length === 0}
    <p style="color:#9ca3af;font-size:0.875rem">
      No jobs with tracer links yet. Enable tracer links on a job to start tracking PDF opens.
    </p>
  {:else}
    <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse;font-size:0.875rem">
        <thead>
          <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
            <th style="text-align:left;padding:0.75rem 1rem;font-weight:600;color:#374151">Job</th>
            <th style="text-align:left;padding:0.75rem 1rem;font-weight:600;color:#374151">Employer</th>
            <th style="text-align:left;padding:0.75rem 1rem;font-weight:600;color:#374151">Links</th>
            <th style="text-align:right;padding:0.75rem 1rem;font-weight:600;color:#374151">Total Clicks</th>
          </tr>
        </thead>
        <tbody>
          {#each data.jobs as job (job.id)}
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:0.75rem 1rem">
                <a href={`/jobs/${job.id}`} style="color:#1d4ed8;text-decoration:none;font-weight:500">{job.title}</a>
              </td>
              <td style="padding:0.75rem 1rem;color:#6b7280">{job.employer ?? "—"}</td>
              <td style="padding:0.75rem 1rem;color:#6b7280">{job.tracerLinks.length}</td>
              <td style="padding:0.75rem 1rem;text-align:right;font-weight:600;color:{job.totalClicks > 0 ? '#15803d' : '#9ca3af'}">{job.totalClicks}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
