/**
 * jobspy.ts — Node HTTP client for the Python extractor sidecar.
 *
 * The sidecar (services/extractor/http_server.py) wraps python-jobspy behind
 * a FastAPI server. This module is the only Node code that talks to it.
 *
 * Configuration:
 *   EXTRACTOR_URL — base URL of the running sidecar, e.g. http://extractor:8000
 *
 * Error handling:
 *   Non-2xx responses throw an Error with the HTTP status code.
 *   Logging uses console.error for now; will be wired to the pino logger in Phase 6.
 */

/** Raw field names returned by jobspy (snake_case, matching the Python output). */
export interface RawJob {
  id?: string | null;
  site?: string | null;
  job_url?: string | null;
  job_url_direct?: string | null;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  date_posted?: string | null;
  job_type?: string | null;
  min_amount?: number | null;
  max_amount?: number | null;
  currency?: string | null;
  interval?: string | null;
  is_remote?: boolean | null;
  description?: string | null;
  company_url?: string | null;
  company_logo?: string | null;
  company_num_employees?: string | null;
  company_revenue?: string | null;
  company_addresses?: string | null;
  emails?: string | null;
  benefits?: string | null;
}

/** Options accepted by the sidecar's POST /scrape endpoint. */
export interface JobSpyScrapeOptions {
  /** One or more job title / keyword queries. */
  searchTerms: string[];
  /** City, region, or country string passed to job boards. */
  location: string;
  /** Country for the Indeed API (e.g. "USA", "UK"). */
  country: string;
  /** Filter for remote-only listings. */
  isRemote: boolean;
  /** Maximum results per search term (split across sites). */
  resultsWanted: number;
  /** Job boards to query. Defaults to linkedin + indeed + glassdoor. */
  sites?: string[];
}

/**
 * Call the extractor sidecar and return the raw job records.
 *
 * @throws {Error} When EXTRACTOR_URL is not set, the sidecar is unreachable,
 *                 or it returns a non-2xx status.
 */
export async function scrapeJobSpy(options: JobSpyScrapeOptions): Promise<RawJob[]> {
  const baseUrl = process.env.EXTRACTOR_URL;
  if (!baseUrl) {
    throw new Error("EXTRACTOR_URL environment variable is not set");
  }

  const url = `${baseUrl}/scrape`;
  const body = {
    search_terms: options.searchTerms,
    location: options.location,
    country: options.country,
    is_remote: options.isRemote,
    results_wanted: options.resultsWanted,
    sites: options.sites ?? ["linkedin", "indeed", "glassdoor"],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      `[extractor] scrape failed status=${res.status} body=${text.slice(0, 200)}`,
    );
    throw new Error(`Extractor returned ${res.status}`);
  }

  const payload = (await res.json()) as { ok: boolean; data: RawJob[] };
  return payload.data;
}
