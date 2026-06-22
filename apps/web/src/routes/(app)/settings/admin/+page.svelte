<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { trpc } from "$lib/trpc/client.js";
  import type { PageData } from "./$types.js";

  const { data }: { data: PageData } = $props();
  let users = $state(data.users);
  $effect(() => { users = data.users; });

  let newUsername = $state("");
  let newPassword = $state("");
  let newDisplayName = $state("");
  let newIsAdmin = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);

  async function addUser() {
    if (!newUsername.trim() || !newPassword.trim()) return;
    saving = true;
    error = null;
    try {
      await trpc.auth.createUser.mutate({
        username: newUsername.trim(),
        password: newPassword,
        displayName: newDisplayName || undefined,
        isSystemAdmin: newIsAdmin,
      });
      newUsername = "";
      newPassword = "";
      newDisplayName = "";
      newIsAdmin = false;
      await invalidateAll();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to create user";
    } finally {
      saving = false;
    }
  }

  async function toggleDisabled(userId: string) {
    await trpc.auth.toggleUserDisabled.mutate({ userId });
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>Admin — Job-Ops</title>
</svelte:head>

<div style="padding:2rem;max-width:760px;margin:0 auto">
  <h1 style="font-size:1.3rem;font-weight:700;margin:0 0 1.5rem">User Management</h1>

  {#if error}
    <div style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:0.5rem 0.75rem;border-radius:6px;font-size:0.875rem;margin-bottom:1rem">{error}</div>
  {/if}

  <!-- User list -->
  <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:1.5rem">
    {#each users as user (user.id)}
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;border-bottom:1px solid #f3f4f6;opacity:{user.isDisabled ? 0.5 : 1}">
        <div>
          <p style="font-weight:500;font-size:0.875rem;margin:0">{user.displayName ?? user.username}</p>
          <p style="font-size:0.75rem;color:#9ca3af;margin:0">@{user.username}{user.isSystemAdmin ? " · Admin" : ""}</p>
        </div>
        <button onclick={() => toggleDisabled(user.id)} style="font-size:0.8rem;padding:0.3rem 0.75rem;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer;color:{user.isDisabled ? '#15803d' : '#dc2626'}">
          {user.isDisabled ? "Enable" : "Disable"}
        </button>
      </div>
    {/each}
  </div>

  <!-- Add user form -->
  <div style="border:1px solid #e5e7eb;border-radius:8px;padding:1.25rem">
    <h2 style="font-size:0.9rem;font-weight:600;margin:0 0 1rem">Add User</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem">
      <label style="display:block">
        <span style="font-size:0.8rem;color:#374151">Username</span>
        <input type="text" bind:value={newUsername} style="display:block;width:100%;margin-top:0.2rem;padding:0.4rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box" />
      </label>
      <label style="display:block">
        <span style="font-size:0.8rem;color:#374151">Password</span>
        <input type="password" bind:value={newPassword} style="display:block;width:100%;margin-top:0.2rem;padding:0.4rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box" />
      </label>
      <label style="display:block">
        <span style="font-size:0.8rem;color:#374151">Display name (optional)</span>
        <input type="text" bind:value={newDisplayName} style="display:block;width:100%;margin-top:0.2rem;padding:0.4rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;box-sizing:border-box" />
      </label>
      <label style="display:flex;align-items:center;gap:0.5rem;padding-top:1.5rem;cursor:pointer">
        <input type="checkbox" bind:checked={newIsAdmin} />
        <span style="font-size:0.875rem;color:#374151">System admin</span>
      </label>
    </div>
    <button onclick={addUser} disabled={saving || !newUsername.trim() || !newPassword.trim()} style="padding:0.4rem 1.2rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:pointer">
      {saving ? "Creating…" : "Create User"}
    </button>
  </div>
</div>
