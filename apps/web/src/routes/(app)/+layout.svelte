<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();
</script>

<div style="display:flex;min-height:100vh">
  <nav style="width:220px;background:#f4f4f5;padding:1rem;border-right:1px solid #e5e7eb">
    <div style="font-weight:700;margin-bottom:1.5rem">Job-Ops</div>
    <a href="/jobs" style="display:block;padding:0.4rem 0;color:#374151;text-decoration:none">Jobs</a>
    <a href="/settings" style="display:block;padding:0.4rem 0;color:#374151;text-decoration:none">Settings</a>
  </nav>
  <main style="flex:1;overflow-y:auto">
    {@render children()}
  </main>
</div>
