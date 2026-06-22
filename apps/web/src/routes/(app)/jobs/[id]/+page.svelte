<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { trpc } from "$lib/trpc/client.js";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
  let job = $state(data.job);
  $effect(() => { job = data.job; });

  let activeTab = $state<"overview" | "notes" | "tasks" | "interviews" | "documents" | "timeline" | "ghostwriter">("overview");
  // Ghostwriter
  let gwThreadId = $state<string | null>(null);
  let gwMessages = $state<Array<{ id: string; role: string; content: string; createdAt: Date }>>([]);
  let gwInput = $state("");
  let gwStreaming = $state(false);
  let gwStreamingContent = $state("");

  async function gwStartOrLoadThread() {
    const threads = await trpc.chat.threads.list.query({ jobId: job.id });
    if (threads.length > 0) {
      gwThreadId = threads[0].id;
      gwMessages = threads[0].messages.map((m) => ({ ...m, createdAt: new Date(m.createdAt) }));
    } else {
      const thread = await trpc.chat.threads.create.mutate({ jobId: job.id });
      gwThreadId = thread.id;
      gwMessages = [];
    }
  }

  function gwStreamRun(runId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const es = new EventSource(`/api/ghostwriter/stream?runId=${runId}`);
      let accumulated = "";
      es.onmessage = (e) => {
        const data = JSON.parse(e.data) as { type: string; token?: string; messageId?: string; message?: string };
        if (data.type === "token") {
          accumulated += data.token ?? "";
          gwStreamingContent = accumulated;
        } else if (data.type === "done") {
          gwMessages = [...gwMessages, { id: data.messageId ?? runId, role: "assistant", content: accumulated, createdAt: new Date() }];
          gwStreamingContent = "";
          es.close();
          resolve();
        } else if (data.type === "error") {
          es.close();
          reject(new Error(data.message ?? "LLM error"));
        }
      };
      es.onerror = () => { es.close(); reject(new Error("SSE connection error")); };
    });
  }

  async function gwSend() {
    if (!gwInput.trim() || gwStreaming || !gwThreadId) return;
    const content = gwInput.trim();
    gwInput = "";
    gwStreaming = true;
    gwStreamingContent = "";
    try {
      const { runId } = await trpc.chat.sendMessage.mutate({ threadId: gwThreadId, content });
      gwMessages = [...gwMessages, { id: runId, role: "user", content, createdAt: new Date() }];
      await gwStreamRun(runId);
    } catch (e) {
      error = e instanceof Error ? e.message : "Ghostwriter error";
    } finally {
      gwStreaming = false;
    }
  }

  async function gwRegenerate() {
    if (gwStreaming || !gwThreadId) return;
    const lastMsg = gwMessages[gwMessages.length - 1];
    if (lastMsg?.role !== "assistant") return;
    gwMessages = gwMessages.slice(0, -1);
    gwStreaming = true;
    gwStreamingContent = "";
    try {
      const { runId } = await trpc.chat.regenerate.mutate({ threadId: gwThreadId });
      await gwStreamRun(runId);
    } catch (e) {
      error = e instanceof Error ? e.message : "Regenerate error";
    } finally {
      gwStreaming = false;
    }
  }

  async function gwReset() {
    if (!gwThreadId) return;
    await trpc.chat.threads.reset.mutate({ threadId: gwThreadId });
    gwMessages = [];
  }

  let gwCopiedId = $state<string | null>(null);
  async function gwCopy(id: string, content: string) {
    await navigator.clipboard.writeText(content);
    gwCopiedId = id;
    setTimeout(() => { gwCopiedId = null; }, 1500);
  }

  $effect(() => {
    if (activeTab === "ghostwriter" && !gwThreadId) {
      gwStartOrLoadThread();
    }
  });

  // ── Tasks form ────────────────────────────────────────────────────────────────
  let newTaskTitle = $state("");
  let newTaskType  = $state<"prep" | "todo" | "follow_up" | "check_status">("todo");
  let newTaskDue   = $state("");

  async function addTask() {
    if (!newTaskTitle.trim()) return;
    await act("task-add", async () => {
      await trpc.jobs.addTask.mutate({
        jobId: job.id, type: newTaskType,
        title: newTaskTitle.trim(),
        dueDate: newTaskDue || undefined,
      });
      newTaskTitle = ""; newTaskDue = "";
    });
  }

  async function toggleTask(taskId: string, completedAt: Date | null) {
    await act(`task-toggle-${taskId}`, () =>
      trpc.jobs.updateTask.mutate({
        jobId: job.id, taskId,
        completedAt: completedAt ? null : new Date().toISOString(),
      }),
    );
  }

  async function deleteTask(taskId: string) {
    await act(`task-del-${taskId}`, () =>
      trpc.jobs.deleteTask.mutate({ jobId: job.id, taskId }),
    );
  }

  // ── Interviews form ───────────────────────────────────────────────────────────
  let newIvType      = $state<"recruiter_screen" | "technical" | "onsite" | "panel" | "behavioral" | "final">("recruiter_screen");
  let newIvScheduled = $state("");
  let newIvNotes     = $state("");

  async function addInterview() {
    await act("iv-add", async () => {
      await trpc.jobs.addInterview.mutate({
        jobId: job.id, type: newIvType,
        scheduledAt: newIvScheduled || undefined,
        notes: newIvNotes.trim() || undefined,
      });
      newIvScheduled = ""; newIvNotes = "";
    });
  }

  async function setInterviewOutcome(interviewId: string, outcome: "pass" | "fail" | "pending" | "cancelled") {
    await act(`iv-outcome-${interviewId}`, () =>
      trpc.jobs.updateInterview.mutate({
        jobId: job.id, interviewId, outcome,
        completedAt: outcome !== "pending" ? new Date().toISOString() : null,
      }),
    );
  }

  async function deleteInterview(interviewId: string) {
    await act(`iv-del-${interviewId}`, () =>
      trpc.jobs.deleteInterview.mutate({ jobId: job.id, interviewId }),
    );
  }

  let newNoteContent = $state("");
  let editingNoteId = $state<string | null>(null);
  let editingNoteContent = $state("");
  let actionLoading = $state<string | null>(null);
  let error = $state<string | null>(null);

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
      in_progress: "#92400e",
    };
    return map[s] ?? "#374151";
  }

  async function act(key: string, fn: () => Promise<unknown>) {
    error = null;
    actionLoading = key;
    try {
      await fn();
      await invalidateAll();
    } catch (e) {
      error = e instanceof Error ? e.message : "Action failed";
    } finally {
      actionLoading = null;
    }
  }

  async function applyToJob() {
    await act("apply", () => trpc.jobs.markApplied.mutate({ id: job.id }));
  }

  async function verifyJob() {
    await act("verify", () => trpc.jobs.verify.mutate({ id: job.id }));
  }

  async function deleteJob() {
    if (!confirm("Delete this job? This cannot be undone.")) return;
    await act("delete", async () => {
      await trpc.jobs.delete.mutate({ id: job.id });
      goto("/jobs");
    });
  }

  async function submitNote() {
    if (!newNoteContent.trim()) return;
    await act("note-add", async () => {
      await trpc.jobs.addNote.mutate({ jobId: job.id, content: newNoteContent.trim() });
      newNoteContent = "";
    });
  }

  async function saveEditNote() {
    const noteId = editingNoteId;
    if (!noteId || !editingNoteContent.trim()) return;
    await act("note-edit", async () => {
      await trpc.jobs.updateNote.mutate({
        jobId: job.id,
        noteId,
        content: editingNoteContent.trim(),
      });
      editingNoteId = null;
      editingNoteContent = "";
    });
  }

  async function deleteNote(noteId: string) {
    await act(`note-del-${noteId}`, () =>
      trpc.jobs.deleteNote.mutate({ jobId: job.id, noteId }),
    );
  }

  async function openDocument(docId: string) {
    const { url } = await trpc.jobs.getDocumentUrl.query({ jobId: job.id, documentId: docId });
    window.open(url, "_blank");
  }

  async function removeDocument(docId: string) {
    await act(`doc-del-${docId}`, () =>
      trpc.jobs.deleteDocument.mutate({ jobId: job.id, documentId: docId }),
    );
  }

  const salary = $derived(formatSalary());
</script>

<svelte:head>
  <title>{job.title ?? "Job"} — Job-Ops</title>
</svelte:head>

<div style="padding:2rem;max-width:900px;margin:0 auto">
  <a href="/jobs" style="font-size:0.875rem;color:#6b7280;text-decoration:none;display:inline-block;margin-bottom:1.25rem">
    ← Back to Jobs
  </a>

  <!-- Header -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">
    <div>
      <h1 style="font-size:1.6rem;font-weight:700;margin:0">{job.title ?? "Untitled"}</h1>
      {#if job.employer}
        <p style="font-size:1rem;color:#6b7280;margin:0.25rem 0 0">{job.employer}</p>
      {/if}
    </div>
    <span style="font-size:0.8rem;font-weight:600;padding:0.3rem 0.8rem;border-radius:6px;background:#f3f4f6;color:{statusColour(job.status)}">
      {job.status}
    </span>
  </div>

  <!-- Meta strip -->
  <div style="display:flex;flex-wrap:wrap;gap:1rem;font-size:0.875rem;color:#6b7280;padding:0.75rem 1rem;background:#f9fafb;border-radius:6px;margin-bottom:1rem">
    {#if job.location}
      <span>📍 {job.location}{job.isRemote ? " · Remote" : ""}</span>
    {:else if job.isRemote}
      <span>📍 Remote</span>
    {/if}
    {#if job.jobType}<span>🗂 {job.jobType}</span>{/if}
    {#if salary}<span>💰 {salary}</span>{/if}
    {#if job.scoreOverall !== null}
      <span>⭐ Score: <strong>{Math.round(job.scoreOverall)}</strong></span>
    {/if}
    {#if job.appliedAt}
      <span>✅ Applied: {new Date(job.appliedAt).toLocaleDateString()}</span>
    {/if}
  </div>

  <!-- Action bar -->
  {#if error}
    <div style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:0.5rem 0.75rem;border-radius:6px;font-size:0.875rem;margin-bottom:0.75rem">{error}</div>
  {/if}
  <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1.5rem">
    {#if job.pdfPublicUrl}
      <a href={job.pdfPublicUrl} target="_blank" rel="noopener noreferrer"
        style="padding:0.4rem 1rem;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-size:0.875rem;font-weight:600">
        Download PDF
      </a>
    {/if}
    {#if job.url}
      <a href={job.url} target="_blank" rel="noopener noreferrer"
        style="padding:0.4rem 1rem;background:#f3f4f6;color:#374151;border-radius:6px;text-decoration:none;font-size:0.875rem">
        View Posting ↗
      </a>
    {/if}
    {#if job.status !== "applied"}
      <button onclick={applyToJob} disabled={!!actionLoading}
        style="padding:0.4rem 1rem;background:#15803d;color:#fff;border:none;border-radius:6px;font-size:0.875rem;cursor:pointer;opacity:{actionLoading === 'apply' ? 0.6 : 1}">
        {actionLoading === "apply" ? "Applying…" : "Mark Applied"}
      </button>
    {/if}
    {#if job.status !== "ready"}
      <button onclick={verifyJob} disabled={!!actionLoading}
        style="padding:0.4rem 1rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.875rem;cursor:pointer;opacity:{actionLoading === 'verify' ? 0.6 : 1}">
        {actionLoading === "verify" ? "Updating…" : "Mark Ready"}
      </button>
    {/if}
    <button onclick={deleteJob} disabled={!!actionLoading}
      style="padding:0.4rem 1rem;background:#fff;color:#dc2626;border:1px solid #fecaca;border-radius:6px;font-size:0.875rem;cursor:pointer;margin-left:auto">
      Delete
    </button>
  </div>

  <!-- Tabs -->
  <div style="border-bottom:2px solid #e5e7eb;display:flex;gap:0;margin-bottom:1.5rem">
    {#each [["overview","Overview"],["notes","Notes"],["tasks","Tasks"],["interviews","Interviews"],["documents","Documents"],["timeline","Timeline"],["ghostwriter","Ghostwriter"]] as [tab, label]}
      <button
        onclick={() => activeTab = tab as typeof activeTab}
        style="padding:0.6rem 1.2rem;border:none;background:none;font-size:0.875rem;font-weight:{activeTab === tab ? 700 : 400};color:{activeTab === tab ? '#1d4ed8' : '#6b7280'};border-bottom:{activeTab === tab ? '2px solid #1d4ed8' : '2px solid transparent'};margin-bottom:-2px;cursor:pointer"
      >{label}</button>
    {/each}
  </div>

  <!-- Overview tab -->
  {#if activeTab === "overview"}
    {#if job.scoreReasoning}
      <section style="margin-bottom:1.5rem">
        <h2 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">AI Reasoning</h2>
        <p style="font-size:0.875rem;color:#374151;line-height:1.6;white-space:pre-wrap">{job.scoreReasoning}</p>
      </section>
    {/if}
    {#if job.tailoredSummary}
      <section style="margin-bottom:1.5rem">
        <h2 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">Tailored Summary</h2>
        <p style="font-size:0.875rem;color:#374151;line-height:1.6">{job.tailoredSummary}</p>
      </section>
    {/if}
    {#if job.jobDescription}
      <section style="margin-bottom:1.5rem">
        <h2 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">Job Description</h2>
        <div style="font-size:0.875rem;color:#374151;line-height:1.7;white-space:pre-wrap;max-height:400px;overflow-y:auto;padding:1rem;background:#f9fafb;border-radius:6px">
          {job.jobDescription}
        </div>
      </section>
    {/if}
  {/if}

  <!-- Notes tab -->
  {#if activeTab === "notes"}
    <div style="margin-bottom:1.5rem">
      <textarea
        bind:value={newNoteContent}
        placeholder="Add a note…"
        rows="3"
        style="width:100%;padding:0.6rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;font-family:inherit;resize:vertical;box-sizing:border-box"
      ></textarea>
      <button
        onclick={submitNote}
        disabled={!newNoteContent.trim() || !!actionLoading}
        style="margin-top:0.5rem;padding:0.4rem 1rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.875rem;cursor:pointer"
      >Add Note</button>
    </div>

    {#if job.notes.length === 0}
      <p style="color:#9ca3af;font-size:0.875rem">No notes yet.</p>
    {:else}
      {#each [...job.notes].reverse() as note (note.id)}
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
          {#if editingNoteId === note.id}
            <textarea
              bind:value={editingNoteContent}
              rows="3"
              style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;font-family:inherit;resize:vertical;box-sizing:border-box"
            ></textarea>
            <div style="display:flex;gap:0.5rem;margin-top:0.5rem">
              <button onclick={saveEditNote} style="padding:0.3rem 0.8rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer">Save</button>
              <button onclick={() => { editingNoteId = null; editingNoteContent = ""; }} style="padding:0.3rem 0.8rem;background:#f3f4f6;color:#374151;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer">Cancel</button>
            </div>
          {:else}
            <p style="font-size:0.875rem;color:#374151;white-space:pre-wrap;margin:0 0 0.5rem">{note.content}</p>
            <div style="display:flex;gap:0.75rem;align-items:center">
              <span style="font-size:0.75rem;color:#9ca3af">{new Date(note.updatedAt).toLocaleString()}</span>
              <button onclick={() => { editingNoteId = note.id; editingNoteContent = note.content; }} style="font-size:0.75rem;color:#6b7280;background:none;border:none;cursor:pointer;padding:0">Edit</button>
              <button onclick={() => deleteNote(note.id)} style="font-size:0.75rem;color:#dc2626;background:none;border:none;cursor:pointer;padding:0">Delete</button>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  {/if}

  <!-- Tasks tab -->
  {#if activeTab === "tasks"}
    <div style="margin-bottom:1.5rem;padding:1rem;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb">
      <h3 style="font-size:0.875rem;font-weight:600;margin:0 0 0.75rem">Add Task</h3>
      <div style="display:grid;grid-template-columns:1fr auto;gap:0.5rem;align-items:end">
        <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.8rem">
          Title
          <input type="text" bind:value={newTaskTitle} placeholder="e.g. Follow up with recruiter"
            style="padding:0.45rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem" />
        </label>
        <button onclick={addTask} disabled={!newTaskTitle.trim() || !!actionLoading}
          style="padding:0.45rem 1rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.875rem;cursor:pointer">
          Add
        </button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:0.5rem">
        <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.8rem">
          Type
          <select bind:value={newTaskType} style="padding:0.45rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.8rem">
            <option value="todo">To-do</option>
            <option value="prep">Prep</option>
            <option value="follow_up">Follow-up</option>
            <option value="check_status">Check status</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.8rem">
          Due date <span style="color:#9ca3af">(optional)</span>
          <input type="date" bind:value={newTaskDue}
            style="padding:0.45rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.8rem" />
        </label>
      </div>
    </div>

    {#if job.tasks.length === 0}
      <p style="color:#9ca3af;font-size:0.875rem">No tasks yet.</p>
    {:else}
      {#each job.tasks as task (task.id)}
        <div style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.75rem 1rem;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:0.5rem;background:{task.completedAt ? '#f9fafb' : '#fff'}">
          <input type="checkbox" checked={!!task.completedAt} onchange={() => toggleTask(task.id, task.completedAt as Date | null)}
            style="margin-top:3px;flex-shrink:0;cursor:pointer" />
          <div style="flex:1;min-width:0">
            <p style="font-size:0.875rem;margin:0;color:#111;text-decoration:{task.completedAt ? 'line-through' : 'none'};opacity:{task.completedAt ? 0.6 : 1}">
              {task.title}
            </p>
            <div style="display:flex;gap:0.75rem;margin-top:0.25rem;flex-wrap:wrap">
              <span style="font-size:0.7rem;padding:0.1rem 0.4rem;background:#f3f4f6;border-radius:4px;color:#6b7280">{task.type.replace(/_/g, " ")}</span>
              {#if task.dueDate}
                <span style="font-size:0.7rem;color:#9ca3af">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
              {/if}
              {#if task.completedAt}
                <span style="font-size:0.7rem;color:#15803d">Done {new Date(task.completedAt).toLocaleDateString()}</span>
              {/if}
            </div>
          </div>
          <button onclick={() => deleteTask(task.id)}
            style="flex-shrink:0;font-size:0.75rem;color:#dc2626;background:none;border:none;cursor:pointer;padding:0">
            Delete
          </button>
        </div>
      {/each}
    {/if}
  {/if}

  <!-- Interviews tab -->
  {#if activeTab === "interviews"}
    <div style="margin-bottom:1.5rem;padding:1rem;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb">
      <h3 style="font-size:0.875rem;font-weight:600;margin:0 0 0.75rem">Schedule Interview</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
        <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.8rem">
          Type
          <select bind:value={newIvType} style="padding:0.45rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.8rem">
            <option value="recruiter_screen">Recruiter Screen</option>
            <option value="technical">Technical</option>
            <option value="onsite">Onsite</option>
            <option value="panel">Panel</option>
            <option value="behavioral">Behavioral</option>
            <option value="final">Final</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.8rem">
          Scheduled date/time <span style="color:#9ca3af">(optional)</span>
          <input type="datetime-local" bind:value={newIvScheduled}
            style="padding:0.45rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.8rem" />
        </label>
      </div>
      <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.8rem;margin-top:0.5rem">
        Notes <span style="color:#9ca3af">(optional)</span>
        <textarea bind:value={newIvNotes} rows="2"
          style="padding:0.45rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.8rem;font-family:inherit;resize:vertical"></textarea>
      </label>
      <button onclick={addInterview} disabled={!!actionLoading}
        style="margin-top:0.75rem;padding:0.45rem 1.25rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.875rem;cursor:pointer">
        Add Interview
      </button>
    </div>

    {#if job.interviews.length === 0}
      <p style="color:#9ca3af;font-size:0.875rem">No interviews scheduled.</p>
    {:else}
      {#each [...job.interviews].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) as iv (iv.id)}
        {@const outcomeColor: Record<string, string> = { pass: "#15803d", fail: "#dc2626", pending: "#854d0e", cancelled: "#6b7280" }}
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;flex-wrap:wrap">
            <div>
              <p style="font-size:0.875rem;font-weight:600;margin:0;text-transform:capitalize">{iv.type.replace(/_/g, " ")}</p>
              {#if iv.scheduledAt}
                <p style="font-size:0.75rem;color:#6b7280;margin:0.2rem 0 0">Scheduled: {new Date(iv.scheduledAt).toLocaleString()}</p>
              {/if}
              {#if iv.completedAt}
                <p style="font-size:0.75rem;color:#6b7280;margin:0.15rem 0 0">Completed: {new Date(iv.completedAt).toLocaleDateString()}</p>
              {/if}
              {#if iv.notes}
                <p style="font-size:0.8rem;color:#374151;margin:0.4rem 0 0;white-space:pre-wrap">{iv.notes}</p>
              {/if}
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0">
              {#if iv.outcome}
                <span style="font-size:0.75rem;font-weight:600;padding:0.2rem 0.5rem;border-radius:4px;background:#f3f4f6;color:{outcomeColor[iv.outcome] ?? '#6b7280'}">
                  {iv.outcome}
                </span>
              {/if}
              <button onclick={() => deleteInterview(iv.id)}
                style="font-size:0.75rem;color:#dc2626;background:none;border:none;cursor:pointer;padding:0">
                Delete
              </button>
            </div>
          </div>
          {#if !iv.outcome || iv.outcome === "pending"}
            <div style="display:flex;gap:0.4rem;margin-top:0.75rem;flex-wrap:wrap">
              <span style="font-size:0.75rem;color:#6b7280;align-self:center">Outcome:</span>
              <button onclick={() => setInterviewOutcome(iv.id, "pass")}
                style="padding:0.2rem 0.6rem;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:4px;font-size:0.75rem;cursor:pointer">
                Pass
              </button>
              <button onclick={() => setInterviewOutcome(iv.id, "fail")}
                style="padding:0.2rem 0.6rem;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:4px;font-size:0.75rem;cursor:pointer">
                Fail
              </button>
              <button onclick={() => setInterviewOutcome(iv.id, "cancelled")}
                style="padding:0.2rem 0.6rem;background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db;border-radius:4px;font-size:0.75rem;cursor:pointer">
                Cancelled
              </button>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  {/if}

  <!-- Documents tab -->
  {#if activeTab === "documents"}
    {#if job.documents.length === 0}
      <p style="color:#9ca3af;font-size:0.875rem">No documents attached.</p>
    {:else}
      {#each job.documents as doc (doc.id)}
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:0.75rem 1rem;margin-bottom:0.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem">
          <div>
            <p style="font-weight:500;font-size:0.875rem;margin:0">{doc.title}</p>
            <p style="font-size:0.75rem;color:#9ca3af;margin:0.1rem 0 0">
              {doc.mimeType}{doc.sizeBytes ? ` · ${Math.round(doc.sizeBytes / 1024)} KB` : ""}
              · {new Date(doc.uploadedAt).toLocaleDateString()}
            </p>
          </div>
          <div style="display:flex;gap:0.5rem">
            <button onclick={() => openDocument(doc.id)} style="padding:0.3rem 0.75rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer">Download</button>
            <button onclick={() => removeDocument(doc.id)} style="padding:0.3rem 0.75rem;background:#fff;color:#dc2626;border:1px solid #fecaca;border-radius:6px;font-size:0.8rem;cursor:pointer">Remove</button>
          </div>
        </div>
      {/each}
    {/if}
  {/if}

  <!-- Timeline tab -->
  {#if activeTab === "timeline"}
    {#if job.stageEvents.length === 0}
      <p style="color:#9ca3af;font-size:0.875rem">No stage events recorded.</p>
    {:else}
      <div style="border-left:2px solid #e5e7eb;padding-left:1.5rem">
        {#each [...job.stageEvents].reverse() as ev (ev.id)}
          <div style="margin-bottom:1rem;position:relative">
            <div style="position:absolute;left:-1.625rem;top:0.25rem;width:10px;height:10px;border-radius:50%;background:#1d4ed8;border:2px solid #fff;box-shadow:0 0 0 2px #e5e7eb"></div>
            <p style="font-weight:600;font-size:0.875rem;margin:0;text-transform:capitalize">{ev.stage.replace(/_/g, " ")}</p>
            <p style="font-size:0.75rem;color:#9ca3af;margin:0.1rem 0">{new Date(ev.timestamp).toLocaleString()}</p>
            {#if ev.note}<p style="font-size:0.875rem;color:#374151;margin:0.25rem 0 0">{ev.note}</p>{/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  <!-- Ghostwriter tab -->
  {#if activeTab === "ghostwriter"}
    {#if !gwThreadId}
      <p style="color:#9ca3af;font-size:0.875rem">Loading…</p>
    {:else}
      <div style="display:flex;flex-direction:column;height:520px">
        <!-- Messages -->
        <div style="flex:1;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:0.75rem;display:flex;flex-direction:column;gap:0.75rem">
          {#if gwMessages.length === 0 && !gwStreamingContent}
            <p style="color:#9ca3af;font-size:0.875rem;text-align:center;margin:auto">Ask Ghostwriter to draft a cover letter, email, or any application content for this job.</p>
          {/if}
          {#each gwMessages as msg, i (msg.id)}
            <div style="display:flex;flex-direction:column;align-items:{msg.role === 'user' ? 'flex-end' : 'flex-start'}">
              <div style="max-width:80%;padding:0.6rem 0.9rem;border-radius:12px;background:{msg.role === 'user' ? '#1d4ed8' : '#f3f4f6'};color:{msg.role === 'user' ? '#fff' : '#111827'};font-size:0.875rem;line-height:1.6;white-space:pre-wrap">
                {msg.content}
              </div>
              {#if msg.role === "assistant"}
                <div style="display:flex;gap:0.5rem;margin-top:0.2rem;padding:0 0.2rem">
                  <button
                    onclick={() => gwCopy(msg.id, msg.content)}
                    style="font-size:0.7rem;color:#9ca3af;background:none;border:none;cursor:pointer;padding:0"
                  >{gwCopiedId === msg.id ? "Copied!" : "Copy"}</button>
                  {#if i === gwMessages.length - 1}
                    <button
                      onclick={gwRegenerate}
                      disabled={gwStreaming}
                      style="font-size:0.7rem;color:#9ca3af;background:none;border:none;cursor:pointer;padding:0;opacity:{gwStreaming ? 0.5 : 1}"
                    >Regenerate</button>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
          {#if gwStreamingContent}
            <div style="display:flex;justify-content:flex-start">
              <div style="max-width:80%;padding:0.6rem 0.9rem;border-radius:12px;background:#f3f4f6;color:#111827;font-size:0.875rem;line-height:1.6;white-space:pre-wrap">
                {gwStreamingContent}<span style="opacity:0.4">▌</span>
              </div>
            </div>
          {/if}
        </div>

        <!-- Input -->
        <div style="display:flex;gap:0.5rem">
          <textarea
            bind:value={gwInput}
            placeholder="Ask Ghostwriter…"
            rows="2"
            disabled={gwStreaming}
            onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gwSend(); } }}
            style="flex:1;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;font-family:inherit;resize:none"
          ></textarea>
          <div style="display:flex;flex-direction:column;gap:0.25rem">
            <button
              onclick={gwSend}
              disabled={!gwInput.trim() || gwStreaming}
              style="padding:0.5rem 1rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.875rem;cursor:pointer;opacity:{gwStreaming ? 0.6 : 1}"
            >{gwStreaming ? "…" : "Send"}</button>
            <button
              onclick={gwReset}
              disabled={gwStreaming}
              style="padding:0.4rem 0.5rem;background:#f3f4f6;color:#6b7280;border:none;border-radius:6px;font-size:0.75rem;cursor:pointer"
            >Clear</button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>
