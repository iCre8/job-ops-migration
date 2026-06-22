<script lang="ts">
  import { trpc } from "$lib/trpc/client.js";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  // ── Connection state ──────────────────────────────────────────────────────────
  let tracking  = $state(data.tracking);
  let syncing   = $state(false);
  let syncResult = $state("");
  let syncError  = $state("");

  // ── Inbox state ───────────────────────────────────────────────────────────────
  type Msg = typeof data.inbox.messages[number];
  let inboxFilter  = $state<"pending" | "approved" | "denied" | "all">("pending");
  let inboxMsgs    = $state<Msg[]>(data.inbox.messages);
  let inboxTotal   = $state(data.inbox.total);
  let inboxLoading = $state(false);
  let selected     = $state<Set<string>>(new Set());
  let bulkBusy     = $state(false);

  // ── Sync runs ─────────────────────────────────────────────────────────────────
  type SyncRun = typeof data.syncRuns[number];
  let syncRuns = $state<SyncRun[]>(data.syncRuns);

  // ── Tab ───────────────────────────────────────────────────────────────────────
  let tab = $state<"inbox" | "history" | "connection">("inbox");

  // ── Labels ────────────────────────────────────────────────────────────────────
  const STATUS_COLOR: Record<string, string> = {
    connected: "#15803d", connecting: "#854d0e",
    disconnected: "#991b1b", not_configured: "#6b7280",
  };
  const STATUS_LABEL: Record<string, string> = {
    connected: "Connected", connecting: "Connecting…",
    disconnected: "Disconnected", not_configured: "Not configured",
  };
  const CLASS_LABEL: Record<string, string> = {
    interview_invite: "Interview", offer: "Offer",
    rejection: "Rejection", follow_up: "Follow-up", other: "Other",
  };
  const CLASS_COLOR: Record<string, string> = {
    interview_invite: "#7c3aed", offer: "#15803d",
    rejection: "#dc2626", follow_up: "#0369a1", other: "#6b7280",
  };
  const REL_COLOR: Record<string, string> = { high: "#15803d", medium: "#854d0e", low: "#6b7280" };

  // ── Connection actions ────────────────────────────────────────────────────────
  async function syncNow() {
    syncing = true; syncResult = ""; syncError = "";
    try {
      const r = await trpc.tracking.sync.mutate();
      syncResult = `Sync complete — ${r.discovered} discovered, ${r.stored} stored.`;
      // Refresh pending count
      const s = await trpc.tracking.status.query();
      tracking = s;
      // Refresh inbox if on pending tab
      if (inboxFilter === "pending") await loadInbox("pending");
      // Refresh sync runs
      syncRuns = (await trpc.tracking.syncRuns.list.query({ limit: 20 })) as SyncRun[];
      setTimeout(() => { syncResult = ""; }, 5000);
    } catch (err) {
      syncError = err instanceof Error ? err.message : "Sync failed";
    } finally {
      syncing = false;
    }
  }

  // ── Inbox actions ─────────────────────────────────────────────────────────────
  async function loadInbox(filter: typeof inboxFilter) {
    inboxLoading = true;
    try {
      const r = await trpc.tracking.inbox.list.query({ filter, limit: 50 });
      inboxMsgs  = r.messages as Msg[];
      inboxTotal = r.total;
      selected   = new Set();
    } finally {
      inboxLoading = false;
    }
  }

  async function changeFilter(f: typeof inboxFilter) {
    inboxFilter = f;
    await loadInbox(f);
  }

  async function approve(id: string) {
    await trpc.tracking.inbox.approve.mutate({ messageId: id });
    inboxMsgs = inboxMsgs.filter((m) => m.id !== id);
    inboxTotal = Math.max(0, inboxTotal - 1);
    selected.delete(id);
    selected = new Set(selected);
    tracking = { ...tracking, pendingCount: Math.max(0, (tracking.pendingCount ?? 0) - 1) };
  }

  async function deny(id: string) {
    await trpc.tracking.inbox.deny.mutate({ messageId: id });
    inboxMsgs = inboxMsgs.filter((m) => m.id !== id);
    inboxTotal = Math.max(0, inboxTotal - 1);
    selected.delete(id);
    selected = new Set(selected);
    tracking = { ...tracking, pendingCount: Math.max(0, (tracking.pendingCount ?? 0) - 1) };
  }

  async function bulkApprove() {
    if (!selected.size) return;
    bulkBusy = true;
    try {
      await trpc.tracking.inbox.bulkApprove.mutate({ messageIds: [...selected] });
      inboxMsgs  = inboxMsgs.filter((m) => !selected.has(m.id));
      inboxTotal = Math.max(0, inboxTotal - selected.size);
      tracking   = { ...tracking, pendingCount: Math.max(0, (tracking.pendingCount ?? 0) - selected.size) };
      selected   = new Set();
    } finally {
      bulkBusy = false;
    }
  }

  async function bulkDeny() {
    if (!selected.size) return;
    bulkBusy = true;
    try {
      await trpc.tracking.inbox.bulkDeny.mutate({ messageIds: [...selected] });
      inboxMsgs  = inboxMsgs.filter((m) => !selected.has(m.id));
      inboxTotal = Math.max(0, inboxTotal - selected.size);
      tracking   = { ...tracking, pendingCount: Math.max(0, (tracking.pendingCount ?? 0) - selected.size) };
      selected   = new Set();
    } finally {
      bulkBusy = false;
    }
  }

  function toggleSelect(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    selected = s;
  }

  function toggleAll() {
    if (selected.size === inboxMsgs.length) {
      selected = new Set();
    } else {
      selected = new Set(inboxMsgs.map((m) => m.id));
    }
  }
</script>

<svelte:head><title>Tracking — Job-Ops</title></svelte:head>

<div style="padding:1.5rem;max-width:900px;margin:0 auto">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;flex-wrap:wrap;gap:0.75rem">
    <div>
      <h1 style="font-size:1.4rem;font-weight:700;margin:0">Email Tracking</h1>
      <p style="color:#6b7280;font-size:0.8rem;margin:0.25rem 0 0">Gmail integration — automatically classify job application emails.</p>
    </div>
    <!-- Quick status chip -->
    <span style="font-size:0.8rem;font-weight:600;padding:0.3rem 0.75rem;border-radius:999px;background:#f3f4f6;color:{STATUS_COLOR[tracking.status] ?? '#6b7280'}">
      {STATUS_LABEL[tracking.status] ?? tracking.status}
      {#if tracking.email} · {tracking.email}{/if}
    </span>
  </div>

  <!-- Flash/error banners -->
  {#if data.flash === "connected"}
    <div style="margin-bottom:1rem;padding:0.7rem 1rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:0.875rem;color:#15803d">
      Gmail connected successfully.
    </div>
  {/if}
  {#if data.error}
    <div style="margin-bottom:1rem;padding:0.7rem 1rem;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:0.875rem;color:#991b1b">
      OAuth error: {data.error}
    </div>
  {/if}

  <!-- Tab bar -->
  <div style="display:flex;gap:0;border-bottom:1px solid #e5e7eb;margin-bottom:1.5rem">
    {#each [
      { id: "inbox", label: "Inbox", badge: (tracking.pendingCount ?? 0) > 0 ? String(tracking.pendingCount) : null },
      { id: "history", label: "Sync History", badge: null },
      { id: "connection", label: "Connection", badge: null },
    ] as t}
      <button onclick={() => { tab = t.id as typeof tab; }}
        style="padding:0.6rem 1.1rem;border:none;border-bottom:2px solid {tab === t.id ? '#0070f3' : 'transparent'};background:none;font-size:0.875rem;font-weight:{tab === t.id ? '600' : '400'};color:{tab === t.id ? '#0070f3' : '#374151'};cursor:pointer;display:flex;align-items:center;gap:0.4rem">
        {t.label}
        {#if t.badge}
          <span style="background:#ef4444;color:#fff;font-size:0.7rem;font-weight:700;padding:0.1rem 0.4rem;border-radius:999px">{t.badge}</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- ── INBOX TAB ────────────────────────────────────────────────────────────── -->
  {#if tab === "inbox"}

    <!-- Filter + bulk actions bar -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:0.75rem">
      <div style="display:flex;gap:0.25rem">
        {#each [["pending","Pending"],["approved","Approved"],["denied","Denied"],["all","All"]] as [f, label]}
          <button onclick={() => changeFilter(f as typeof inboxFilter)}
            style="padding:0.3rem 0.75rem;border-radius:6px;border:1px solid {inboxFilter === f ? '#0070f3' : '#d1d5db'};background:{inboxFilter === f ? '#eff6ff' : '#fff'};color:{inboxFilter === f ? '#0070f3' : '#374151'};font-size:0.8rem;cursor:pointer">
            {label}
          </button>
        {/each}
      </div>

      {#if selected.size > 0}
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span style="font-size:0.8rem;color:#6b7280">{selected.size} selected</span>
          <button onclick={bulkApprove} disabled={bulkBusy}
            style="padding:0.3rem 0.75rem;background:#15803d;color:#fff;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer">
            Approve all
          </button>
          <button onclick={bulkDeny} disabled={bulkBusy}
            style="padding:0.3rem 0.75rem;background:#dc2626;color:#fff;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer">
            Deny all
          </button>
        </div>
      {/if}
    </div>

    {#if inboxLoading}
      <p style="color:#9ca3af;font-size:0.875rem">Loading…</p>
    {:else if inboxMsgs.length === 0}
      <div style="text-align:center;padding:2.5rem;border:2px dashed #e5e7eb;border-radius:8px;color:#9ca3af">
        <p style="margin:0;font-weight:500">No {inboxFilter === "all" ? "" : inboxFilter} messages</p>
        {#if inboxFilter === "pending"}
          <p style="font-size:0.8rem;margin-top:0.5rem">Connect Gmail and run a sync to import emails.</p>
        {/if}
      </div>
    {:else}
      <!-- Select all row -->
      <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;color:#6b7280;margin-bottom:0.5rem;cursor:pointer">
        <input type="checkbox" checked={selected.size === inboxMsgs.length && inboxMsgs.length > 0} onchange={toggleAll} />
        Select all ({inboxMsgs.length} of {inboxTotal})
      </label>

      <div style="display:flex;flex-direction:column;gap:0.5rem">
        {#each inboxMsgs as msg (msg.id)}
          <div style="padding:0.85rem 1rem;border:1px solid {selected.has(msg.id) ? '#93c5fd' : '#e5e7eb'};border-radius:8px;background:{selected.has(msg.id) ? '#eff6ff' : '#fff'};display:grid;gap:0.4rem">
            <div style="display:flex;align-items:flex-start;gap:0.75rem">
              <input type="checkbox" checked={selected.has(msg.id)} onchange={() => toggleSelect(msg.id)}
                style="margin-top:3px;flex-shrink:0" />
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;flex-wrap:wrap">
                  <p style="font-size:0.875rem;font-weight:600;margin:0;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px">
                    {msg.subject ?? "(no subject)"}
                  </p>
                  <div style="display:flex;gap:0.4rem;flex-shrink:0">
                    {#if msg.classification}
                      <span style="font-size:0.7rem;font-weight:600;padding:0.15rem 0.5rem;background:#f3f4f6;border-radius:4px;color:{CLASS_COLOR[msg.classification] ?? '#6b7280'}">
                        {CLASS_LABEL[msg.classification] ?? msg.classification}
                      </span>
                    {/if}
                    {#if msg.relevance}
                      <span style="font-size:0.7rem;padding:0.15rem 0.5rem;background:#f9fafb;border-radius:4px;color:{REL_COLOR[msg.relevance] ?? '#6b7280'}">
                        {msg.relevance}
                      </span>
                    {/if}
                    {#if msg.approved === true}
                      <span style="font-size:0.7rem;font-weight:600;padding:0.15rem 0.5rem;background:#f0fdf4;border-radius:4px;color:#15803d">approved</span>
                    {:else if msg.approved === false}
                      <span style="font-size:0.7rem;font-weight:600;padding:0.15rem 0.5rem;background:#fef2f2;border-radius:4px;color:#dc2626">denied</span>
                    {/if}
                  </div>
                </div>
                {#if msg.fromAddress}
                  <p style="font-size:0.75rem;color:#6b7280;margin:0.15rem 0 0">{msg.fromAddress}</p>
                {/if}
                {#if msg.rawSnippet}
                  <p style="font-size:0.8rem;color:#374151;margin:0.25rem 0 0;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
                    {msg.rawSnippet}
                  </p>
                {/if}
                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.4rem;flex-wrap:wrap;gap:0.4rem">
                  {#if msg.receivedAt}
                    <span style="font-size:0.7rem;color:#9ca3af">{new Date(msg.receivedAt).toLocaleString()}</span>
                  {/if}
                  {#if msg.approved === null}
                    <div style="display:flex;gap:0.4rem">
                      <button onclick={() => approve(msg.id)}
                        style="padding:0.25rem 0.7rem;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:5px;font-size:0.75rem;font-weight:600;cursor:pointer">
                        Approve
                      </button>
                      <button onclick={() => deny(msg.id)}
                        style="padding:0.25rem 0.7rem;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:5px;font-size:0.75rem;font-weight:600;cursor:pointer">
                        Deny
                      </button>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

  <!-- ── SYNC HISTORY TAB ────────────────────────────────────────────────────── -->
  {:else if tab === "history"}
    <h2 style="font-size:1rem;font-weight:600;margin:0 0 1rem">Sync Runs</h2>
    {#if syncRuns.length === 0}
      <p style="color:#9ca3af;font-size:0.875rem">No sync runs yet.</p>
    {:else}
      <div style="display:flex;flex-direction:column;gap:0.5rem">
        {#each syncRuns as run}
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0.7rem 1rem;border:1px solid #e5e7eb;border-radius:6px;flex-wrap:wrap;gap:0.5rem">
            <div>
              <p style="font-size:0.875rem;font-weight:600;margin:0;color:{run.error ? '#dc2626' : '#111'}">
                {run.error ? "Failed" : "Success"}
              </p>
              {#if run.error}
                <p style="font-size:0.75rem;color:#dc2626;margin:0">{run.error}</p>
              {:else}
                <p style="font-size:0.75rem;color:#6b7280;margin:0">
                  {run.discovered ?? 0} discovered · {run.stored ?? 0} stored
                </p>
              {/if}
            </div>
            <div style="text-align:right">
              {#if run.completedAt}
                <p style="font-size:0.75rem;color:#9ca3af;margin:0">{new Date(run.completedAt).toLocaleString()}</p>
              {/if}
              {#if run.startedAt && run.completedAt}
                {@const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()}
                <p style="font-size:0.7rem;color:#9ca3af;margin:0">{(ms / 1000).toFixed(1)}s</p>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}

  <!-- ── CONNECTION TAB ─────────────────────────────────────────────────────── -->
  {:else if tab === "connection"}
    <section style="padding:1.25rem;border:1px solid #e5e7eb;border-radius:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
        <div>
          <p style="font-size:0.8rem;color:#6b7280;margin:0 0 0.25rem">Gmail integration</p>
          <span style="font-size:1rem;font-weight:700;color:{STATUS_COLOR[tracking.status] ?? '#6b7280'}">
            {STATUS_LABEL[tracking.status] ?? tracking.status}
          </span>
          {#if tracking.email}
            <p style="font-size:0.85rem;color:#374151;margin:0.25rem 0 0">{tracking.email}</p>
          {/if}
          {#if tracking.lastSyncAt}
            <p style="font-size:0.75rem;color:#9ca3af;margin:0.25rem 0 0">
              Last sync: {new Date(tracking.lastSyncAt).toLocaleString()}
            </p>
          {/if}
        </div>

        <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
          {#if tracking.status === "connected"}
            <button onclick={syncNow} disabled={syncing}
              style="padding:0.5rem 1.1rem;background:{syncing ? '#93c5fd' : '#2563eb'};color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:{syncing ? 'not-allowed' : 'pointer'}">
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
            <a href="/tracking?disconnect=1"
              style="padding:0.5rem 1.1rem;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;font-weight:600;text-decoration:none">
              Disconnect
            </a>
          {:else if data.authUrl}
            <a href={data.authUrl}
              style="padding:0.5rem 1.1rem;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;text-decoration:none">
              Connect Gmail
            </a>
          {:else}
            <p style="font-size:0.875rem;color:#9ca3af">Set <code>GMAIL_OAUTH_CLIENT_ID</code> to enable OAuth.</p>
          {/if}
        </div>
      </div>

      {#if syncResult}
        <p style="margin-top:0.75rem;font-size:0.875rem;color:#15803d">{syncResult}</p>
      {/if}
      {#if syncError}
        <p style="margin-top:0.75rem;font-size:0.875rem;color:#991b1b">{syncError}</p>
      {/if}
    </section>
  {/if}
</div>
