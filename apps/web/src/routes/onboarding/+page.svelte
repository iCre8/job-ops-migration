<script lang="ts">
  import { goto } from "$app/navigation";
  import { trpc } from "$lib/trpc/client.js";

  let username = $state("");
  let password = $state("");
  let displayName = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    loading = true;
    try {
      await trpc.auth.setup.mutate({ username, password, displayName: displayName || undefined });
      goto("/jobs");
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : "Setup failed";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Setup — Job-Ops</title>
</svelte:head>

<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f9fafb;font-family:sans-serif">
  <div style="width:100%;max-width:400px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:2rem">
    <h1 style="font-size:1.4rem;font-weight:700;margin:0 0 0.25rem">Welcome to Job-Ops</h1>
    <p style="color:#6b7280;font-size:0.875rem;margin:0 0 1.5rem">Create your admin account to get started.</p>

    {#if error}
      <div style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:0.6rem 0.8rem;border-radius:6px;font-size:0.875rem;margin-bottom:1rem">
        {error}
      </div>
    {/if}

    <form onsubmit={submit}>
      <label style="display:block;margin-bottom:1rem">
        <span style="font-size:0.875rem;font-weight:500;color:#374151">Username</span>
        <input
          type="text"
          bind:value={username}
          autocomplete="username"
          required
          placeholder="e.g. admin"
          style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box"
        />
      </label>

      <label style="display:block;margin-bottom:1rem">
        <span style="font-size:0.875rem;font-weight:500;color:#374151">Display name <span style="font-weight:400;color:#9ca3af">(optional)</span></span>
        <input
          type="text"
          bind:value={displayName}
          autocomplete="name"
          placeholder="e.g. Rob"
          style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box"
        />
      </label>

      <label style="display:block;margin-bottom:1.5rem">
        <span style="font-size:0.875rem;font-weight:500;color:#374151">Password <span style="font-weight:400;color:#9ca3af">(min 8 chars)</span></span>
        <input
          type="password"
          bind:value={password}
          autocomplete="new-password"
          required
          minlength="8"
          style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        style="width:100%;padding:0.6rem;background:#0070f3;color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:{loading ? 'wait' : 'pointer'};opacity:{loading ? 0.7 : 1}"
      >
        {loading ? "Creating account…" : "Create Account"}
      </button>
    </form>
  </div>
</div>
