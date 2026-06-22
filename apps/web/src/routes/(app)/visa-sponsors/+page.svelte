<script lang="ts">
  let query = $state("");
  let results = $state<Array<{ name: string; city: string; county: string; route: string }>>([]);
  let loading = $state(false);
  let searched = $state(false);
  let extractorUrl = $state(
    typeof window !== "undefined" ? (document.querySelector("meta[name=extractor-url]") as HTMLMetaElement | null)?.content ?? "" : "",
  );

  async function search() {
    if (!query.trim()) return;
    loading = true;
    searched = true;
    results = [];
    try {
      const base = extractorUrl || (typeof window !== "undefined" ? window.location.origin : "");
      const url = `${base}/visa-sponsors/search?q=${encodeURIComponent(query.trim())}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { results?: Array<{ sponsor?: { organisationName?: string; townCity?: string; county?: string; route?: string } }> };
      results = (data.results ?? []).map((r) => ({
        name: r.sponsor?.organisationName ?? "",
        city: r.sponsor?.townCity ?? "",
        county: r.sponsor?.county ?? "",
        route: r.sponsor?.route ?? "",
      }));
    } catch {
      results = [];
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Visa Sponsors — Job-Ops</title>
</svelte:head>

<div style="padding:2rem;max-width:760px;margin:0 auto">
  <h1 style="font-size:1.3rem;font-weight:700;margin:0 0 0.5rem">Visa Sponsor Search</h1>
  <p style="color:#6b7280;font-size:0.875rem;margin:0 0 1.5rem">
    Search the UK Home Office register of licensed sponsors. Requires the extractor sidecar to be running.
  </p>

  <form onsubmit={(e) => { e.preventDefault(); search(); }} style="display:flex;gap:0.5rem;margin-bottom:1.5rem">
    <input
      type="text"
      bind:value={query}
      placeholder="Company name…"
      style="flex:1;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem"
    />
    <button
      type="submit"
      disabled={loading || !query.trim()}
      style="padding:0.5rem 1.2rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:pointer;opacity:{loading ? 0.6 : 1}"
    >{loading ? "Searching…" : "Search"}</button>
  </form>

  {#if searched && results.length === 0 && !loading}
    <p style="color:#9ca3af;font-size:0.875rem">No results found. Make sure the extractor sidecar is running and has downloaded the sponsor data.</p>
  {/if}

  {#if results.length > 0}
    <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse;font-size:0.875rem">
        <thead>
          <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
            <th style="text-align:left;padding:0.6rem 1rem;font-weight:600;color:#374151">Organisation</th>
            <th style="text-align:left;padding:0.6rem 1rem;font-weight:600;color:#374151">Location</th>
            <th style="text-align:left;padding:0.6rem 1rem;font-weight:600;color:#374151">Route</th>
          </tr>
        </thead>
        <tbody>
          {#each results as r, i (i)}
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:0.6rem 1rem;font-weight:500">{r.name}</td>
              <td style="padding:0.6rem 1rem;color:#6b7280">{[r.city, r.county].filter(Boolean).join(", ") || "—"}</td>
              <td style="padding:0.6rem 1rem;color:#6b7280">{r.route || "—"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
