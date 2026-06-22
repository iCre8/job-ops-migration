<script lang="ts">
  import type { Snippet } from "svelte";
  import type { LayoutData } from "./$types.js";

  interface Props {
    children: Snippet;
    data: LayoutData;
  }

  const { children, data }: Props = $props();
  const { user } = data;
</script>

<div style="display:flex;min-height:100vh;font-family:sans-serif">
  <nav style="width:200px;flex-shrink:0;background:#f4f4f5;padding:1rem;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;gap:0.1rem">
    <div style="font-weight:700;margin-bottom:1rem;font-size:0.9rem;color:#111">Job-Ops</div>

    <a href="/overview" style="display:block;padding:0.35rem 0.6rem;color:#374151;text-decoration:none;border-radius:5px;font-size:0.875rem">Overview</a>
    <a href="/jobs" style="display:block;padding:0.35rem 0.6rem;color:#374151;text-decoration:none;border-radius:5px;font-size:0.875rem">Jobs</a>
    <a href="/applications" style="display:block;padding:0.35rem 0.6rem;color:#374151;text-decoration:none;border-radius:5px;font-size:0.875rem">Applications</a>
    <a href="/watchlist" style="display:block;padding:0.35rem 0.6rem;color:#374151;text-decoration:none;border-radius:5px;font-size:0.875rem">Watchlist</a>
    <a href="/tracer-links" style="display:block;padding:0.35rem 0.6rem;color:#374151;text-decoration:none;border-radius:5px;font-size:0.875rem">Tracer Links</a>
    <a href="/visa-sponsors" style="display:block;padding:0.35rem 0.6rem;color:#374151;text-decoration:none;border-radius:5px;font-size:0.875rem">Visa Sponsors</a>
    <a href="/design-resume" style="display:block;padding:0.35rem 0.6rem;color:#374151;text-decoration:none;border-radius:5px;font-size:0.875rem">Resume Studio</a>
    <a href="/tracking" style="display:block;padding:0.35rem 0.6rem;color:#374151;text-decoration:none;border-radius:5px;font-size:0.875rem">Email Tracking</a>
    <a href="/settings" style="display:block;padding:0.35rem 0.6rem;color:#374151;text-decoration:none;border-radius:5px;font-size:0.875rem">Settings</a>
    {#if user?.isSystemAdmin}
      <a href="/settings/admin" style="display:block;padding:0.35rem 0.6rem;color:#374151;text-decoration:none;border-radius:5px;font-size:0.875rem">Admin</a>
    {/if}

    <div style="margin-top:auto;padding-top:1rem;border-top:1px solid #e5e7eb">
      <p style="font-size:0.75rem;color:#9ca3af;margin:0 0 0.4rem">{user?.username ?? ""}</p>
      <a href="/sign-in" style="font-size:0.75rem;color:#6b7280;text-decoration:none">Sign out</a>
    </div>
  </nav>

  <main style="flex:1;overflow-y:auto">
    {@render children()}
  </main>
</div>
