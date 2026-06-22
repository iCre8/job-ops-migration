<script lang="ts">
  import type { PageData } from "./$types.js";

  const { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Applications — Job-Ops</title>
</svelte:head>

<div style="padding:1.5rem;overflow-x:auto">
  <h1 style="font-size:1.3rem;font-weight:700;margin:0 0 1.25rem">In-Progress Applications</h1>

  <div style="display:flex;gap:1rem;min-width:fit-content">
    {#each data.columns as col (col.key)}
      <div style="width:260px;flex-shrink:0">
        <div style="font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;padding:0 0.25rem;margin-bottom:0.75rem">
          {col.label} <span style="font-weight:400;color:#9ca3af">({col.jobs.length})</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.5rem">
          {#each col.jobs as job (job.id)}
            <a
              href={`/jobs/${job.id}`}
              style="display:block;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:0.75rem;text-decoration:none;color:inherit;transition:box-shadow 0.1s"
            >
              <p style="font-weight:600;font-size:0.875rem;margin:0 0 0.2rem;color:#111827">{job.title}</p>
              {#if job.employer}
                <p style="font-size:0.8rem;color:#6b7280;margin:0 0 0.4rem">{job.employer}</p>
              {/if}
              {#if job.appliedAt}
                <p style="font-size:0.75rem;color:#9ca3af;margin:0">
                  Applied {new Date(job.appliedAt).toLocaleDateString()}
                </p>
              {/if}
              {#if job.scoreOverall !== null && job.scoreOverall !== undefined}
                <p style="font-size:0.75rem;color:#9ca3af;margin:0.1rem 0 0">Score: {Math.round(job.scoreOverall)}</p>
              {/if}
            </a>
          {/each}
          {#if col.jobs.length === 0}
            <div style="border:2px dashed #e5e7eb;border-radius:8px;padding:1.5rem;text-align:center">
              <p style="color:#d1d5db;font-size:0.8rem;margin:0">Empty</p>
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>
