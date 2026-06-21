<script lang="ts">
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  let syncing = $state(false);
  let syncResult = $state("");
  let syncError = $state("");

  const STATUS_LABEL: Record<string, string> = {
    connected: "Connected",
    connecting: "Connecting…",
    disconnected: "Disconnected",
    not_configured: "Not configured",
  };

  const STATUS_COLOR: Record<string, string> = {
    connected: "#15803d",
    connecting: "#854d0e",
    disconnected: "#991b1b",
    not_configured: "#6b7280",
  };

  const CLASS_LABEL: Record<string, string> = {
    interview_invite: "Interview",
    offer: "Offer",
    rejection: "Rejection",
    follow_up: "Follow-up",
    other: "Other",
  };

  const RELEVANCE_COLOR: Record<string, string> = {
    high: "#15803d",
    medium: "#854d0e",
    low: "#6b7280",
  };

  async function syncNow() {
    syncing = true;
    syncResult = "";
    syncError = "";
    try {
      const input = encodeURIComponent(JSON.stringify({ "0": { json: {} } }));
      const res = await fetch(
        `/api/trpc/tracking.sync?batch=1&input=${input}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const [result] = (await res.json()) as [{ result: { data: { json: { discovered: number; stored: number } } } }];
      const d = result.result.data.json;
      syncResult = `Sync complete — ${d.discovered} discovered, ${d.stored} stored.`;
      setTimeout(() => { syncResult = ""; }, 5000);
    } catch (err) {
      syncError = err instanceof Error ? err.message : "Sync failed";
    } finally {
      syncing = false;
    }
  }
</script>

<svelte:head>
  <title>Tracking — Job-Ops</title>
</svelte:head>

<div style="padding:2rem;max-width:800px;margin:0 auto">
  <h1 style="font-size:1.5rem;font-weight:700;margin:0 0 0.25rem">Email Tracking</h1>
  <p style="color:#6b7280;font-size:0.875rem;margin:0 0 2rem">
    Gmail integration — automatically classify job application emails.
  </p>

  <!-- Flash / error banners -->
  {#if data.flash === "connected"}
    <div style="margin-bottom:1rem;padding:0.75rem 1rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:0.875rem;color:#15803d" role="status">
      Gmail connected successfully.
    </div>
  {/if}
  {#if data.error}
    <div style="margin-bottom:1rem;padding:0.75rem 1rem;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:0.875rem;color:#991b1b" role="alert">
      OAuth error: {data.error}
    </div>
  {/if}

  <!-- Integration status card -->
  <section style="margin-bottom:2rem;padding:1.25rem;border:1px solid #e5e7eb;border-radius:8px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div>
        <p style="font-size:0.8rem;color:#6b7280;margin:0 0 0.25rem">Status</p>
        <span
          style="font-size:0.875rem;font-weight:600;color:{STATUS_COLOR[data.tracking.status] ?? '#6b7280'}"
          aria-label="Gmail integration status"
        >
          {STATUS_LABEL[data.tracking.status] ?? data.tracking.status}
        </span>
        {#if data.tracking.email}
          <p style="font-size:0.8rem;color:#6b7280;margin:0.25rem 0 0">{data.tracking.email}</p>
        {/if}
        {#if data.tracking.lastSyncAt}
          <p style="font-size:0.75rem;color:#9ca3af;margin:0.25rem 0 0">
            Last sync: {new Date(data.tracking.lastSyncAt).toLocaleString()}
          </p>
        {/if}
      </div>

      <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
        {#if data.tracking.status === "connected"}
          <button
            onclick={syncNow}
            disabled={syncing}
            aria-label="Sync Gmail now"
            style="padding:0.5rem 1.1rem;background:{syncing ? '#93c5fd' : '#2563eb'};color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:{syncing ? 'not-allowed' : 'pointer'}"
          >
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
          <a
            href="/tracking?disconnect=1"
            aria-label="Disconnect Gmail"
            style="padding:0.5rem 1.1rem;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;font-weight:600;text-decoration:none"
          >
            Disconnect
          </a>
        {:else if data.authUrl}
          <a
            href={data.authUrl}
            aria-label="Connect Gmail"
            style="padding:0.5rem 1.1rem;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;text-decoration:none"
          >
            Connect Gmail
          </a>
        {:else}
          <p style="font-size:0.875rem;color:#9ca3af">
            Set <code>GMAIL_OAUTH_CLIENT_ID</code> to enable OAuth.
          </p>
        {/if}
      </div>
    </div>

    {#if syncResult}
      <p style="margin-top:0.75rem;font-size:0.875rem;color:#15803d" role="status">{syncResult}</p>
    {/if}
    {#if syncError}
      <p style="margin-top:0.75rem;font-size:0.875rem;color:#991b1b" role="alert">{syncError}</p>
    {/if}
  </section>

  <!-- Messages list -->
  <section>
    <h2 style="font-size:1rem;font-weight:600;margin:0 0 1rem">
      Recent Messages ({data.tracking.messages.length})
    </h2>

    {#if data.tracking.messages.length === 0}
      <div style="text-align:center;padding:2.5rem;border:2px dashed #e5e7eb;border-radius:8px;color:#9ca3af">
        <p style="margin:0">No messages yet</p>
        <p style="font-size:0.875rem;margin-top:0.5rem">Connect Gmail and run a sync to import emails.</p>
      </div>
    {:else}
      <div style="display:flex;flex-direction:column;gap:0.5rem">
        {#each data.tracking.messages as msg (msg.id)}
          <div style="padding:0.75rem 1rem;border:1px solid #e5e7eb;border-radius:6px;display:grid;gap:0.25rem">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;flex-wrap:wrap">
              <p style="font-size:0.875rem;font-weight:600;margin:0;color:#111827">
                {msg.subject ?? "(no subject)"}
              </p>
              <div style="display:flex;gap:0.5rem">
                <span style="font-size:0.75rem;font-weight:600;padding:0.15rem 0.5rem;background:#f3f4f6;border-radius:4px;color:{RELEVANCE_COLOR[msg.relevance ?? 'low'] ?? '#6b7280'}">
                  {msg.relevance ?? "low"}
                </span>
                <span style="font-size:0.75rem;padding:0.15rem 0.5rem;background:#eff6ff;border-radius:4px;color:#2563eb">
                  {CLASS_LABEL[msg.classification ?? "other"] ?? "Other"}
                </span>
              </div>
            </div>
            {#if msg.fromAddress}
              <p style="font-size:0.75rem;color:#6b7280;margin:0">{msg.fromAddress}</p>
            {/if}
            {#if msg.rawSnippet}
              <p style="font-size:0.8rem;color:#374151;margin:0;white-space:pre-wrap;line-height:1.5">
                {msg.rawSnippet}
              </p>
            {/if}
            {#if msg.receivedAt}
              <p style="font-size:0.7rem;color:#9ca3af;margin:0">
                {new Date(msg.receivedAt).toLocaleString()}
              </p>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>
