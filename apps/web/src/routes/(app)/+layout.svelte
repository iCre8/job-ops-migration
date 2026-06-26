<script lang="ts">
  import type { Snippet } from "svelte";
  import type { LayoutData } from "./$types.js";
  import { page } from "$app/stores";

  interface Props {
    children: Snippet;
    data: LayoutData;
  }

  const { children, data }: Props = $props();
  const { user } = data;
</script>

<div class="app-layout">
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="brand">
        <span class="brand-dot"></span>
        Job-Ops
      </div>
    </div>

    <nav class="nav-links">
      <a href="/overview" class="nav-link" class:active={$page.url.pathname.startsWith('/overview')}>
        <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
        Overview
      </a>
      <a href="/jobs" class="nav-link" class:active={$page.url.pathname.startsWith('/jobs') || $page.url.pathname.startsWith('/job/')}>
        <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        Jobs
      </a>
      <a href="/applications" class="nav-link" class:active={$page.url.pathname.startsWith('/applications')}>
        <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        Applications
      </a>
      <a href="/watchlist" class="nav-link" class:active={$page.url.pathname.startsWith('/watchlist')}>
        <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        Watchlist
      </a>
      <a href="/tracer-links" class="nav-link" class:active={$page.url.pathname.startsWith('/tracer-links')}>
        <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        Tracer Links
      </a>
      <a href="/visa-sponsors" class="nav-link" class:active={$page.url.pathname.startsWith('/visa-sponsors')}>
        <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Visa Sponsors
      </a>
      <a href="/design-resume" class="nav-link" class:active={$page.url.pathname.startsWith('/design-resume')}>
        <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Resume Studio
      </a>
      <a href="/tracking" class="nav-link" class:active={$page.url.pathname.startsWith('/tracking')}>
        <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Email Tracking
      </a>
      <a href="/settings" class="nav-link" class:active={$page.url.pathname === '/settings'}>
        <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        Settings
      </a>
      {#if user?.isSystemAdmin}
        <a href="/settings/admin" class="nav-link" class:active={$page.url.pathname.startsWith('/settings/admin')}>
          <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="3"/><path d="M8 17a4 4 0 0 1 8 0"/></svg>
          Admin
        </a>
      {/if}
    </nav>

    <div class="sidebar-footer">
      <div class="user-profile">
        <div class="avatar">{user?.displayName?.slice(0, 2).toUpperCase() ?? "AD"}</div>
        <div class="user-info">
          <span class="username">{user?.displayName ?? user?.username ?? "User"}</span>
          <span class="user-role">{user?.isSystemAdmin ? "Administrator" : "User"}</span>
        </div>
      </div>
      <a href="/sign-in" class="sign-out-btn">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Sign out
      </a>
    </div>
  </aside>

  <main class="main-content">
    {@render children()}
  </main>
</div>

<style>
  .app-layout {
    display: flex;
    min-height: 100vh;
    background-color: var(--bg-app);
  }

  .sidebar {
    width: var(--sidebar-width);
    flex-shrink: 0;
    background-color: var(--bg-sidebar);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    height: 100vh;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .sidebar-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .brand {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.65rem;
    letter-spacing: -0.03em;
  }

  .brand-dot {
    width: 8px;
    height: 8px;
    background-color: var(--accent-color);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--accent-color);
  }

  .nav-links {
    padding: 1.25rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    overflow-y: auto;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    color: var(--text-secondary);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .nav-link:hover {
    background-color: var(--bg-card-hover);
    color: var(--text-primary);
  }

  .nav-link.active {
    background-color: var(--accent-bg);
    color: #ffffff;
    border-left: 2px solid var(--accent-color);
    padding-left: calc(0.75rem - 2px);
  }

  .nav-icon {
    flex-shrink: 0;
    opacity: 0.7;
    transition: opacity var(--transition-fast);
  }

  .nav-link:hover .nav-icon,
  .nav-link.active .nav-icon {
    opacity: 1;
    color: var(--accent-text);
  }

  .sidebar-footer {
    padding: 1.25rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background-color: rgba(0, 0, 0, 0.2);
  }

  .user-profile {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: var(--accent-bg);
    border: 1px solid var(--border-accent);
    color: var(--accent-text);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .username {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  .user-role {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .sign-out-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    padding: 0.45rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);
    transition: all var(--transition-fast);
  }

  .sign-out-btn:hover {
    color: var(--danger-text);
    border-color: var(--danger-border);
    background-color: var(--danger-bg);
  }

  .main-content {
    flex: 1;
    height: 100vh;
    overflow-y: auto;
    background-color: var(--bg-app);
  }
</style>
