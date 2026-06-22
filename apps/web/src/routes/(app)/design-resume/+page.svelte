<script lang="ts">
  import { trpc } from "$lib/trpc/client.js";
  import type { PageData } from "./$types.js";

  const { data }: { data: PageData } = $props();

  let selectedId = $state<string | null>(null);
  let pdfUrl = $state<string | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(data.error ?? null);

  async function openPdf(resumeId: string) {
    loading = true;
    error = null;
    try {
      const { url } = await trpc.designResume.exportPdfUrl.query({ resumeId });
      pdfUrl = url;
      window.open(url, "_blank");
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to get PDF";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Design Resume — Job-Ops</title>
</svelte:head>

<div style="padding:2rem;max-width:800px;margin:0 auto">
  <h1 style="font-size:1.3rem;font-weight:700;margin:0 0 0.5rem">Resume Studio</h1>
  <p style="color:#6b7280;font-size:0.875rem;margin:0 0 1.5rem">
    Manage your base resumes in RxResume. Select a resume to export as PDF or open in the RxResume editor.
  </p>

  {#if error}
    <div style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:0.6rem 0.8rem;border-radius:6px;font-size:0.875rem;margin-bottom:1rem">{error}</div>
  {/if}

  {#if data.resumes.length === 0 && !error}
    <p style="color:#9ca3af;font-size:0.875rem">
      No resumes found. Make sure <code>RXRESUME_URL</code>, <code>RXRESUME_EMAIL</code>, and <code>RXRESUME_PASSWORD</code> are configured, then create a resume in RxResume.
    </p>
  {:else}
    <div style="display:flex;flex-direction:column;gap:0.5rem">
      {#each data.resumes as resume (resume.id)}
        <div style="border:1px solid {selectedId === resume.id ? '#1d4ed8' : '#e5e7eb'};border-radius:8px;padding:0.75rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;cursor:pointer;background:{selectedId === resume.id ? '#eff6ff' : '#fff'}"
          onclick={() => selectedId = resume.id}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && (selectedId = resume.id)}
        >
          <div>
            <p style="font-weight:500;font-size:0.875rem;margin:0">{resume.title}</p>
            {#if resume.updatedAt}
              <p style="font-size:0.75rem;color:#9ca3af;margin:0.1rem 0 0">
                Updated {new Date(resume.updatedAt).toLocaleDateString()}
              </p>
            {/if}
          </div>
          <div style="display:flex;gap:0.5rem">
            <button
              onclick={(e) => { e.stopPropagation(); openPdf(resume.id); }}
              disabled={loading}
              style="padding:0.35rem 0.8rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer"
            >Export PDF</button>
            <a
              href={`${process.env.RXRESUME_URL ?? 'https://rxresu.me'}/builder/${resume.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onclick={(e) => e.stopPropagation()}
              style="padding:0.35rem 0.8rem;background:#f3f4f6;color:#374151;border:none;border-radius:6px;font-size:0.8rem;text-decoration:none"
            >Edit ↗</a>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
